import { openDB } from "idb";
import type { Credentials, Workspace } from "./types";

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
    false,
    ["encrypt", "decrypt"],
  );
}
export class Vault {
  private chain: Promise<unknown> = Promise.resolve();
  private constructor(
    readonly id: string,
    private key: CryptoKey,
    private salt: Uint8Array<ArrayBuffer>,
  ) {}
  static async open(
    credentials: Credentials,
  ): Promise<{ vault: Vault; data?: Workspace }> {
    if (!crypto.subtle)
      throw new Error(
        "O acesso offline precisa de HTTPS ou localhost neste navegador.",
      );
    const id = await identity(credentials);
    const db = await database();
    const saved: Envelope | undefined = await db.get("vaults", id);
    db.close();
    const salt = saved?.salt ?? crypto.getRandomValues(new Uint8Array(16));
    const key = await derive(credentials.secret, salt);
    const vault = new Vault(id, key, salt);
    if (!saved) return { vault };
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: saved.iv },
        key,
        saved.ciphertext,
      );
      return {
        vault,
        data: JSON.parse(new TextDecoder().decode(plaintext)) as Workspace,
      };
    } catch {
      throw new Error(
        "Não foi possível abrir os dados locais. Confira as credenciais. Se o PIN mudou, use o PIN anterior para recuperar rascunhos antes de preparar um novo acesso.",
      );
    }
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
        .request(`educaxp:${this.id}`, { ifAvailable: true }, async (lock) => {
          if (!lock) {
            reject(
              new Error(
                "Este perfil já está aberto em outra aba. Encerre o acesso naquela aba para continuar.",
              ),
            );
            return;
          }
          await new Promise<void>((release) => resolve(release));
        })
        .catch(reject);
    });
  }
}
