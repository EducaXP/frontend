import { openDB } from "idb";
import type { AccessSnapshot } from "./session-access";
import type { VaultAccess } from "./vault";
export const TAB_SESSION_KEY = "educaxp-tab-session-v1";
export interface TabSnapshot {
  access: AccessSnapshot;
  vault?: VaultAccess;
  expiresAt: number;
}
interface Handle {
  id: string;
  key: number[];
}
interface Envelope {
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
  expiresAt: number;
}
const database = () =>
  openDB("educaxp-tab-access-v1", 1, {
    upgrade(db) {
      db.createObjectStore("sessions");
    },
  });
export class TabSession {
  private closed = false;
  private chain: Promise<unknown> = Promise.resolve();
  private constructor(
    private handle: Handle,
    private key: CryptoKey,
    readonly expiresAt: number,
  ) {}
  static async create(snapshot: Omit<TabSnapshot, "expiresAt">) {
    const handle = {
      id: crypto.randomUUID(),
      key: [...crypto.getRandomValues(new Uint8Array(32))],
    };
    const key = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(handle.key),
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    );
    const expiresAt = Math.min(
      Date.now() + 12 * 3600000,
      snapshot.access.authenticated?.expiresAt || Infinity,
    );
    const session = new TabSession(handle, key, expiresAt);
    await session.save(snapshot);
    try {
      sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(handle));
    } catch (error) {
      await session.clear();
      throw error;
    }
    return session;
  }
  static async restore(): Promise<{
    session: TabSession;
    snapshot: TabSnapshot;
  } | null> {
    const raw = sessionStorage.getItem(TAB_SESSION_KEY);
    if (!raw) return null;
    let session: TabSession | undefined;
    try {
      const handle = JSON.parse(raw) as Handle;
      const db = await database();
      let envelope: Envelope | undefined;
      try {
        envelope = await db.get("sessions", handle.id);
      } finally {
        db.close();
      }
      if (!envelope) {
        sessionStorage.removeItem(TAB_SESSION_KEY);
        return null;
      }
      const key = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(handle.key),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"],
      );
      session = new TabSession(handle, key, envelope.expiresAt);
      if (envelope.expiresAt <= Date.now()) {
        await session.clear();
        return null;
      }
      const bytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: envelope.iv },
        key,
        envelope.ciphertext,
      );
      const snapshot = JSON.parse(
        new TextDecoder().decode(bytes),
      ) as TabSnapshot;
      if (
        snapshot.expiresAt !== envelope.expiresAt ||
        !snapshot.access.expectedUserId
      )
        throw Error("Acesso inválido.");
      return { session, snapshot };
    } catch {
      sessionStorage.removeItem(TAB_SESSION_KEY);
      return null;
    }
  }
  save(snapshot: Omit<TabSnapshot, "expiresAt">) {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ ...snapshot, expiresAt: this.expiresAt }),
    );
    const work = this.chain
      .catch(() => {})
      .then(async () => {
        if (this.closed) return;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          this.key,
          bytes,
        );
        const db = await database();
        try {
          const tx = db.transaction("sessions", "readwrite");
          // Keep expired restoration capsules bounded without touching any draft vault.
          let cursor = await tx.store.openCursor();
          while (cursor) {
            if (cursor.value.expiresAt <= Date.now()) await cursor.delete();
            cursor = await cursor.continue();
          }
          if (!this.closed)
            await tx.store.put(
              { iv, ciphertext, expiresAt: this.expiresAt },
              this.handle.id,
            );
          await tx.done;
        } finally {
          db.close();
        }
      });
    this.chain = work;
    return work;
  }
  detach() {
    if (sessionStorage.getItem(TAB_SESSION_KEY) === JSON.stringify(this.handle))
      sessionStorage.removeItem(TAB_SESSION_KEY);
  }
  async clear() {
    this.closed = true;
    await this.chain.catch(() => {});
    const db = await database();
    try {
      await db.delete("sessions", this.handle.id);
    } finally {
      db.close();
      this.detach();
    }
  }
}
