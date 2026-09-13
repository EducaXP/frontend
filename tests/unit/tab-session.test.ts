import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deleteDB, openDB } from "idb";
import { TabSession, TAB_SESSION_KEY } from "../../src/tab-session";
import { Vault } from "../../src/vault";
import type { Workspace } from "../../src/types";
const user = {
  id: "student",
  name: "Enzo",
  role: "student" as const,
  schoolId: "school",
};
const snapshot = () => ({
  access: {
    expectedUserId: user.id,
    authenticated: {
      token: "private-token",
      expiresAt: Date.now() + 86400000,
      user,
    },
  },
});
beforeEach(async () => {
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => data.get(k) || null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
  await deleteDB("educaxp-tab-access-v1");
  await deleteDB("educaxp-private-v1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("restaura o token cifrado somente com a chave da aba", async () => {
  await TabSession.create(snapshot());
  const handle = sessionStorage.getItem(TAB_SESSION_KEY)!;
  expect(handle).not.toContain("private-token");
  const db = await openDB("educaxp-tab-access-v1", 1);
  const envelope = await db.get("sessions", JSON.parse(handle).id);
  db.close();
  expect(new TextDecoder().decode(envelope.ciphertext)).not.toContain(
    "private-token",
  );
  expect(
    (await TabSession.restore())?.snapshot.access.authenticated?.token,
  ).toBe("private-token");
  sessionStorage.removeItem(TAB_SESSION_KEY);
  expect(await TabSession.restore()).toBeNull();
  const wrong = JSON.parse(handle);
  wrong.key[0] ^= 1;
  sessionStorage.setItem(TAB_SESSION_KEY, JSON.stringify(wrong));
  expect(await TabSession.restore()).toBeNull();
});
it("encerra com gravação pendente, invalida cópia do identificador e preserva o cofre", async () => {
  const { vault } = await Vault.open({
    role: "student",
    login: "",
    alias: "enzo",
    classCode: "TEST",
    secret: "123456",
  });
  const data: Workspace = {
    user,
    authenticatedAt: Date.now(),
    classrooms: [],
    selectedClass: "",
    missions: [],
    groups: [],
    drafts: {},
    updatedAt: 0,
  };
  await vault.save(data);
  const session = await TabSession.create({
    ...snapshot(),
    vault: await vault.exportAccess(),
  });
  const handle = sessionStorage.getItem(TAB_SESSION_KEY)!;
  const restored = await TabSession.restore();
  await vault.save({ ...data, selectedClass: "latest-draft" });
  const reopened = await Vault.restore(restored!.snapshot.vault!);
  expect((await reopened.read()).selectedClass).toBe("latest-draft");
  const pending = session.save(snapshot());
  await session.clear();
  await pending;
  sessionStorage.setItem(TAB_SESSION_KEY, handle);
  expect(await TabSession.restore()).toBeNull();
  expect((await reopened.read()).selectedClass).toBe("latest-draft");
});
it("limita a restauração a 12 horas ou à expiração anterior do token", async () => {
  const start = Date.now();
  const session = await TabSession.create(snapshot());
  expect(session.expiresAt).toBeLessThanOrEqual(start + 12 * 3600000 + 1000);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(session.expiresAt + 1);
  expect(await TabSession.restore()).toBeNull();
  const short = snapshot();
  short.access.authenticated.expiresAt = Date.now() + 60000;
  const limited = await TabSession.create(short);
  expect(limited.expiresAt).toBe(short.access.authenticated.expiresAt);
});
it("remove a credencial offline cifrada ao obter um token", async () => {
  const session = await TabSession.create({
    access: {
      expectedUserId: user.id,
      offlineCredentials: {
        role: "student",
        login: "",
        classCode: "TEST",
        alias: "enzo",
        secret: "654321",
      },
    },
  });
  expect(sessionStorage.getItem(TAB_SESSION_KEY)).not.toContain("654321");
  expect(
    (await TabSession.restore())?.snapshot.access.offlineCredentials?.secret,
  ).toBe("654321");
  await session.save(snapshot());
  expect(
    (await TabSession.restore())?.snapshot.access.offlineCredentials,
  ).toBeUndefined();
});
