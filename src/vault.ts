import { openDB } from "idb";
import type { Credentials, User, Workspace } from "./types";

interface Envelope {
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}
const encoder = new TextEncoder();
const database = () =>
  openDB("educaxp-private-v1", 1, {
    upgrade(db) {
      db.createObjectStore("vaults");
    },
  });
export async function identity(credentials: Credentials) {
  const value =
    credentials.role === "teacher"
      ? `teacher:${credentials.login.trim()}`
      : `student:${credentials.classCode.trim().toUpperCase()}:${credentials.alias.trim().toLowerCase()}`;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function derive(secret: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}
export interface VaultAccess {
  id: string;
  profileId: string;
  salt: number[];
  key: number[];
}
export class Vault {
  private chain: Promise<unknown> = Promise.resolve();
  private constructor(
    readonly id: string,
    private key: CryptoKey,
    private salt: Uint8Array<ArrayBuffer>,
    private profileId: string,
  ) {}
  static async open(
    credentials: Credentials,
    authenticatedUser?: User,
  ): Promise<{ vault: Vault; data?: Workspace; preserved?: boolean }> {
    if (!crypto.subtle)
      throw new Error(
        "O acesso offline precisa de HTTPS ou localhost neste navegador.",
      );
    const profileId = await identity(credentials);
    const db = await database();
    let entries: { id: string; saved: Envelope }[];
    try {
      // Include the original v1 record and any later, separately encrypted copies.
      const tx = db.transaction("vaults");
      const range = IDBKeyRange.bound(profileId, profileId + "\uffff");
      const [keys, values] = await Promise.all([
        tx.store.getAllKeys(range),
        tx.store.getAll(range),
      ]);
      await tx.done;
      entries = keys
        .map((id, i) => ({ id: String(id), saved: values[i] as Envelope }))
        .reverse();
    } finally {
      db.close();
    }
    for (const { id, saved } of entries) {
      const key = await derive(credentials.secret, saved.salt);
      let data: Workspace;
      try {
        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: saved.iv },
          key,
          saved.ciphertext,
        );
        data = JSON.parse(new TextDecoder().decode(plaintext)) as Workspace;
      } catch {
        continue;
      }
      // A recreated account must never inherit the previous owner's drafts or queue.
      if (
        authenticatedUser &&
        (data.user.id !== authenticatedUser.id ||
          data.user.schoolId !== authenticatedUser.schoolId ||
          data.user.role !== authenticatedUser.role)
      )
        continue;
      return { vault: new Vault(id, key, saved.salt, profileId), data };
    }
    if (entries.length && !authenticatedUser)
      throw new Error(
        "Não foi possível abrir os dados locais com estas credenciais. Confira o PIN ou a senha. Se houve uma alteração, conecte-se para validar o novo acesso; os rascunhos anteriores continuam protegidos pela credencial anterior.",
      );
    // Only a confirmed online identity may prepare a fresh copy beside an unreadable
    // or different-account record. Never overwrite or delete that previous record.
    const id = entries.length
      ? profileId +
        ":" +
        String(Date.now()).padStart(16, "0") +
        ":" +
        crypto.randomUUID()
      : profileId;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await derive(credentials.secret, salt);
    return {
      vault: new Vault(id, key, salt, profileId),
      preserved: entries.length > 0,
    };
  }
  async exportAccess(): Promise<VaultAccess> {
    return {
      id: this.id,
      profileId: this.profileId,
      salt: [...this.salt],
      key: [...new Uint8Array(await crypto.subtle.exportKey("raw", this.key))],
    };
  }
  static async restore(access: VaultAccess) {
    const key = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(access.key),
      "AES-GCM",
      true,
      ["encrypt", "decrypt"],
    );
    return new Vault(
      access.id,
      key,
      new Uint8Array(access.salt),
      access.profileId,
    );
  }
  async read(): Promise<Workspace> {
    const db = await database();
    let saved: Envelope | undefined;
    try {
      saved = await db.get("vaults", this.id);
    } finally {
      db.close();
    }
    if (!saved)
      throw new Error("O conteúdo local deste acesso não está disponível.");
    const bytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: saved.iv },
      this.key,
      saved.ciphertext,
    );
    return JSON.parse(new TextDecoder().decode(bytes)) as Workspace;
  }
  save(workspace: Workspace) {
    // Snapshot immediately, then serialize writes so slow encryption never overwrites a later edit.
    const bytes = encoder.encode(JSON.stringify(workspace));
    const write = this.chain
      .catch(() => {})
      .then(async () => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          this.key,
          bytes,
        );
        const db = await database();
        try {
          await db.put(
            "vaults",
            { salt: this.salt, iv, ciphertext } satisfies Envelope,
            this.id,
          );
        } finally {
          db.close();
        }
      });
    this.chain = write;
    return write;
  }
  async flush() {
    await this.chain;
  }
  async acquire(): Promise<() => void> {
    if (!navigator.locks)
      throw new Error(
        "Este navegador não oferece proteção entre abas para o modo offline. Use um navegador compatível ou entre sem preparar acesso offline.",
      );
    return new Promise((resolve, reject) => {
      void navigator.locks
        .request(
          `educaxp:${this.profileId}`,
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              reject(
                new Error(
                  "Este perfil já está aberto em outra aba. Encerre o acesso naquela aba para continuar.",
                ),
              );
              return;
            }
            await new Promise<void>((release) => resolve(release));
          },
        )
        .catch(reject);
    });
  }
}
