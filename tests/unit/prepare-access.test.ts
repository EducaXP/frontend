import "fake-indexeddb/auto";
import { deleteDB, openDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../src/api";
import { Vault, identity } from "../../src/vault";
import { prepareAccess } from "../../src/prepare-access";
import { emptyDraft, queueDraft } from "../../src/sync";
import type { Credentials, User, Workspace } from "../../src/types";
vi.mock("../../src/api", async (original) => ({
  ...(await original<typeof import("../../src/api")>()),
  api: vi.fn(),
}));
const mockApi = vi.mocked(api);
const credentials: Credentials = {
  role: "student",
  login: "",
  classCode: "DEMO",
  alias: "enzo",
  secret: "123456",
};
const user: User = {
  id: "student-one",
  role: "student",
  schoolId: "school-one",
  name: "Enzo",
};
function data(owner = user): Workspace {
  return {
    user: owner,
    authenticatedAt: Date.now(),
    classrooms: [],
    selectedClass: "",
    missions: [],
    groups: [],
    updatedAt: Date.now(),
    drafts: {
      "m:g": queueDraft(
        { ...emptyDraft("m", "g"), evidence: "Rascunho privado anterior" },
        "digital",
      ),
    },
  };
}
async function saved() {
  const db = await openDB("educaxp-private-v1", 1);
  try {
    return await db.getAll("vaults");
  } finally {
    db.close();
  }
}
async function seed(creds = credentials, workspace = data()) {
  const { vault } = await Vault.open(creds);
  await vault.save(workspace);
}
function allow(owner = user) {
  mockApi
    .mockResolvedValueOnce({
      token: "new-session",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    })
    .mockResolvedValueOnce(owner);
}
beforeEach(async () => {
  await deleteDB("educaxp-private-v1");
  mockApi.mockReset();
  mockApi.mockResolvedValue(undefined);
});
describe("entrada com dados locais de acessos anteriores", () => {
  it.each(["student", "teacher"] as const)(
    "%s: credencial nova validada preserva o cofre antigo e prepara acesso offline separado",
    async (role) => {
      const old = {
        ...credentials,
        role,
        login: role === "teacher" ? "maria" : "",
      };
      const owner = { ...user, role };
      await seed(old, data(owner));
      const previous = await saved();
      const current = { ...old, secret: "654321" };
      allow(owner);
      const next = await prepareAccess(current, true, true);
      expect(next.user).toEqual(owner);
      expect(next.local?.data).toBeUndefined();
      expect(next.local?.preserved).toBe(true);
      expect(next.local?.vault.id).not.toBe(await identity(old));
      const fresh = { ...data(owner), drafts: {}, selectedClass: "nova" };
      await next.local!.vault.save(fresh);
      expect((await saved())[0]).toEqual(previous[0]);
      expect((await Vault.open(old)).data?.drafts["m:g"]?.evidence).toBe(
        "Rascunho privado anterior",
      );
      next.access.close();
      const offline = await prepareAccess(current, true, false);
      expect(offline.local?.data).toEqual(fresh);
      expect(offline.authenticated).toBeNull();
      offline.access.close();
    },
  );
  it("reutilizar um login para outra identidade não herda rascunhos nem fila", async () => {
    await seed();
    const previous = await saved();
    const recreated = {
      ...user,
      id: "student-recreated",
      schoolId: "school-two",
    };
    allow(recreated);
    const next = await prepareAccess(credentials, true, true);
    expect(next.local?.data).toBeUndefined();
    await next.local!.vault.save({ ...data(recreated), drafts: {} });
    next.access.close();
    const offline = await prepareAccess(credentials, true, false);
    expect(offline.user).toEqual(recreated);
    expect(offline.local?.data?.drafts).toEqual({});
    expect((await saved())[0]).toEqual(previous[0]);
    offline.access.close();
  });
  it("credenciais recusadas pelo servidor não criam cópia nem abrem o conteúdo local", async () => {
    await seed();
    const previous = await saved();
    mockApi.mockRejectedValueOnce(
      new ApiError(401, "INVALID_CREDENTIALS", "Credenciais inválidas"),
    );
    await expect(prepareAccess(credentials, true, true)).rejects.toThrow(
      "Credenciais inválidas",
    );
    expect(await saved()).toEqual(previous);
  });
  it("sem servidor não prepara cópia com PIN errado nem modifica o cofre existente", async () => {
    await seed();
    const previous = await saved();
    const wrong = { ...credentials, secret: "654321" };
    await expect(prepareAccess(wrong, true, false)).rejects.toThrow(
      "credenciais",
    );
    mockApi.mockRejectedValueOnce(
      new ApiError(503, "UNAVAILABLE", "Servidor indisponível"),
    );
    await expect(prepareAccess(wrong, true, true)).rejects.toThrow(
      "credenciais",
    );
    expect(await saved()).toEqual(previous);
  });
  it("fallback com servidor indisponível mantém o dono original nas futuras reconexões", async () => {
    await seed();
    mockApi.mockRejectedValueOnce(
      new ApiError(503, "UNAVAILABLE", "Indisponível"),
    );
    const local = await prepareAccess(credentials, true, true);
    expect(local.local?.data?.drafts["m:g"]?.evidence).toBe(
      "Rascunho privado anterior",
    );
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120000);
    allow({ ...user, id: "another-account" });
    try {
      expect(await local.access.ensure()).toBeNull();
      expect(local.access.failure?.code).toBe("PROFILE_MISMATCH");
      expect(mockApi).toHaveBeenCalledWith(
        "/auth/logout",
        "new-session",
        "POST",
      );
    } finally {
      clock.mockRestore();
      local.access.close();
    }
  });
  it("mantém validade de sete dias e exige conexão no primeiro acesso", async () => {
    await expect(prepareAccess(credentials, true, false)).rejects.toThrow(
      "primeiro acesso",
    );
    await seed(credentials, {
      ...data(),
      authenticatedAt: Date.now() - 8 * 86400000,
    });
    await expect(prepareAccess(credentials, true, false)).rejects.toThrow(
      "renovar o acesso offline",
    );
  });
  it("acesso temporário online não modifica os rascunhos persistidos", async () => {
    await seed();
    const previous = await saved();
    allow();
    const next = await prepareAccess(
      { ...credentials, secret: "654321" },
      false,
      true,
    );
    expect(next.local).toBeNull();
    expect(await saved()).toEqual(previous);
    next.access.close();
  });
  it("uma falha de armazenamento após autenticar revoga a sessão emitida", async () => {
    allow();
    const opening = vi
      .spyOn(Vault, "open")
      .mockRejectedValueOnce(new Error("Armazenamento indisponível"));
    try {
      await expect(prepareAccess(credentials, true, true)).rejects.toThrow(
        "Armazenamento indisponível",
      );
      expect(mockApi).toHaveBeenCalledWith(
        "/auth/logout",
        "new-session",
        "POST",
      );
    } finally {
      opening.mockRestore();
    }
  });
});
