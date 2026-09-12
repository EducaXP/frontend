import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteDB, openDB } from "idb";
import { Vault, identity } from "../../src/vault";
import { applyReceipt, emptyDraft, queueDraft } from "../../src/sync";
import type { Credentials, Submission, Workspace } from "../../src/types";

const credentials: Credentials = {
  role: "student",
  login: "",
  alias: "enzo",
  classCode: "DEMO123",
  secret: "123456",
};
const workspace = (): Workspace => ({
  user: {
    id: "student-1",
    name: "Enzo fictício",
    role: "student",
    schoolId: "school-1",
  },
  authenticatedAt: Date.now(),
  classrooms: [],
  selectedClass: "",
  missions: [],
  groups: [],
  drafts: {},
  updatedAt: Date.now(),
});
beforeEach(async () => {
  await deleteDB("educaxp-private-v1");
});
describe("armazenamento privado por perfil", () => {
  it("preserva o rascunho cifrado após reabrir sem guardar credencial ou token", async () => {
    const { vault } = await Vault.open(credentials);
    const data = workspace();
    data.drafts["m:g"] = {
      ...emptyDraft("m", "g"),
      evidence: "Texto privado de uma descoberta",
    };
    await vault.save(data);
    expect((await Vault.open(credentials)).data?.drafts["m:g"]?.evidence).toBe(
      "Texto privado de uma descoberta",
    );
    const db = await openDB("educaxp-private-v1", 1);
    const envelope = await db.get("vaults", await identity(credentials));
    db.close();
    expect(envelope.ciphertext).toBeInstanceOf(ArrayBuffer);
    expect(JSON.stringify(envelope)).not.toContain("Texto privado");
    expect(JSON.stringify(envelope)).not.toContain(credentials.secret);
    expect(Object.keys(envelope).sort()).toEqual(["ciphertext", "iv", "salt"]);
  });
  it("PIN incorreto não abre o conteúdo e outro perfil não recebe o rascunho", async () => {
    const { vault } = await Vault.open(credentials);
    await vault.save(workspace());
    await expect(
      Vault.open({ ...credentials, secret: "654321" }),
    ).rejects.toThrow("credenciais");
    expect(
      (await Vault.open({ ...credentials, alias: "bia" })).data,
    ).toBeUndefined();
  });
  it("gravações simultâneas não deixam uma versão antiga por último", async () => {
    const { vault } = await Vault.open(credentials);
    await Promise.all([
      vault.save({ ...workspace(), selectedClass: "primeira" }),
      vault.save({ ...workspace(), selectedClass: "última" }),
    ]);
    expect((await Vault.open(credentials)).data?.selectedClass).toBe("última");
  });
  it("normaliza apenas os campos usados pela autenticação estudantil", async () => {
    expect(await identity(credentials)).toBe(
      await identity({ ...credentials, classCode: " demo123 ", alias: "Enzo" }),
    );
    expect(
      await identity({ ...credentials, role: "teacher", login: "maria" }),
    ).not.toBe(await identity(credentials));
  });
});
describe("fila de sincronização", () => {
  it("repetir envio mantém operação imutável, mesmo após editar o texto local", () => {
    const queued = queueDraft(
      { ...emptyDraft("m", "g"), evidence: "Versão enviada" },
      "digital",
    );
    const edited = queueDraft(
      { ...queued, evidence: "Versão editada offline" },
      "digital",
    );
    expect(edited.pending).toEqual(queued.pending);
    expect(edited.evidence).toBe("Versão editada offline");
  });
  it("recibo não apaga alterações feitas durante o envio", () => {
    const queued = queueDraft(
      { ...emptyDraft("m", "g"), evidence: "Primeira" },
      "digital",
    );
    const received = { id: queued.submissionId, version: 1 } as Submission;
    const result = applyReceipt(
      { ...queued, evidence: "Continuação" },
      queued.pending!.operationId,
      received,
    );
    expect(result.evidence).toBe("Continuação");
    expect(result.status).toBe("local");
    expect(result.baseVersion).toBe(1);
    expect(result.pending).toBeUndefined();
    expect(queueDraft(result, "digital").pending?.baseVersion).toBe(1);
  });
  it("recibo de outra operação não altera a fila atual", () => {
    const queued = queueDraft(emptyDraft("m", "g"), "digital");
    expect(applyReceipt(queued, "outro-id", { version: 3 } as Submission)).toBe(
      queued,
    );
  });
  it("sincronização confirma apenas o conteúdo efetivamente enviado", () => {
    const queued = queueDraft(
      {
        ...emptyDraft("m", "g"),
        evidence: "Descoberta",
        completedSteps: [1, 0],
      },
      "teacher_mediated",
    );
    const result = applyReceipt(queued, queued.pending!.operationId, {
      id: queued.submissionId,
      version: 1,
    } as Submission);
    expect(result.status).toBe("synced");
    expect(result.pending).toBeUndefined();
    expect(result.baseVersion).toBe(1);
  });
});
