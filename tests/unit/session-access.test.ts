import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../src/api";
import { SessionAccess } from "../../src/session-access";
vi.mock("../../src/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/api")>()),
  api: vi.fn(),
}));
const mockApi = vi.mocked(api);
const credentials = {
  role: "student" as const,
  login: "",
  classCode: "DEMO",
  alias: "enzo",
  secret: "123456",
};
const user = {
  id: "student-one",
  role: "student",
  name: "Enzo",
  schoolId: "school-one",
};
const result = (token = "token-one") => ({
  token,
  expiresAt: new Date(Date.now() + 10000).toISOString(),
});
beforeEach(() => {
  vi.useFakeTimers();
  mockApi.mockReset();
});
afterEach(() => vi.useRealTimers());
const allow = (token = "token-one") => {
  mockApi.mockResolvedValueOnce(result(token)).mockResolvedValueOnce(user);
};
describe("retomada automática de acesso", () => {
  it("compartilha autenticação simultânea e renova a sessão expirada sem novo formulário", async () => {
    const access = new SessionAccess(credentials, user.id);
    allow();
    const [first, second] = await Promise.all([
      access.ensure(),
      access.ensure(),
    ]);
    expect(first?.token).toBe("token-one");
    expect(second).toBe(first);
    expect(mockApi).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(11000);
    allow("token-two");
    mockApi.mockResolvedValueOnce(undefined);
    expect((await access.ensure())?.token).toBe("token-two");
    expect(mockApi).toHaveBeenCalledWith(
      "/auth/student-session",
      null,
      "POST",
      { classCode: "DEMO", alias: "enzo", pin: "123456" },
      4000,
    );
  });
  it("respeita Retry-After e tenta novamente sem outra ação do estudante", async () => {
    const access = new SessionAccess(credentials, user.id);
    mockApi.mockRejectedValueOnce(
      new ApiError(429, "RATE_LIMITED", "Aguarde", undefined, 60),
    );
    expect(await access.ensure()).toBeNull();
    expect(access.blocked).toBe(false);
    await vi.advanceTimersByTimeAsync(59000);
    await access.ensure();
    expect(mockApi).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    allow();
    expect((await access.ensure())?.user.id).toBe(user.id);
  });
  it("credenciais recusadas interrompem novas tentativas automáticas", async () => {
    const access = new SessionAccess(credentials, user.id);
    mockApi.mockRejectedValueOnce(
      new ApiError(401, "INVALID_CREDENTIALS", "Acesso recusado"),
    );
    await access.ensure();
    await vi.advanceTimersByTimeAsync(120000);
    await access.ensure();
    expect(access.blocked).toBe(true);
    expect(mockApi).toHaveBeenCalledTimes(1);
  });
  it("uma resposta para outra identidade nunca libera o envio de rascunhos", async () => {
    const access = new SessionAccess(credentials, "another-student");
    allow();
    mockApi.mockResolvedValueOnce(undefined);
    expect(await access.ensure()).toBeNull();
    expect(access.failure?.code).toBe("PROFILE_MISMATCH");
    expect(mockApi).toHaveBeenCalledWith("/auth/logout", "token-one", "POST");
  });
  it("encerrar durante a reconexão descarta a credencial e revoga o token tardio", async () => {
    let complete!: (value: ReturnType<typeof result>) => void;
    mockApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    mockApi.mockResolvedValueOnce(user).mockResolvedValueOnce(undefined);
    const access = new SessionAccess(credentials, user.id);
    const connecting = access.ensure();
    access.close();
    complete(result());
    expect(await connecting).toBeNull();
    expect(await access.ensure()).toBeNull();
    expect(mockApi).toHaveBeenCalledWith("/auth/logout", "token-one", "POST");
    expect(mockApi).toHaveBeenCalledTimes(3);
  });
});

describe("token restaurado", () => {
  const snapshot = () => ({
    expectedUserId: user.id,
    authenticated: {
      token: "restored-token",
      expiresAt: Date.now() + 60000,
      user: { ...user, role: "student" as const },
    },
  });
  it("valida o token no servidor sem enviar novamente PIN ou senha", async () => {
    const access = SessionAccess.restore(snapshot());
    mockApi.mockResolvedValueOnce(user);
    expect((await access.ensure())?.token).toBe("restored-token");
    expect(mockApi).toHaveBeenCalledExactlyOnceWith(
      "/me",
      "restored-token",
      "GET",
      undefined,
      4000,
    );
    expect(access.snapshot().offlineCredentials).toBeUndefined();
  });
  it("mantém o token após falha de rede e revalida ao reconectar", async () => {
    const access = SessionAccess.restore(snapshot());
    mockApi.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "Sem rede"));
    expect(await access.ensure()).toBeNull();
    expect(access.blocked).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    mockApi.mockResolvedValueOnce(user);
    expect((await access.ensure())?.token).toBe("restored-token");
    expect(mockApi.mock.calls.every(([path]) => path === "/me")).toBe(true);
  });
  it("bloqueia token revogado e resposta de outro perfil sem renovar por senha", async () => {
    for (const outcome of [
      new ApiError(401, "UNAUTHORIZED", "Revogado"),
      { ...user, id: "other" },
    ]) {
      mockApi.mockReset();
      const access = SessionAccess.restore(snapshot());
      if (outcome instanceof Error) mockApi.mockRejectedValueOnce(outcome);
      else mockApi.mockResolvedValueOnce(outcome);
      expect(await access.ensure()).toBeNull();
      expect(access.blocked).toBe(true);
      expect(await access.ensure()).toBeNull();
      expect(mockApi).toHaveBeenCalledTimes(1);
    }
  });
  it("exige novo login ao expirar e remove a credencial do snapshot após autenticar", async () => {
    const expired = snapshot();
    expired.authenticated.expiresAt = Date.now() - 1;
    const access = SessionAccess.restore(expired);
    expect(await access.ensure()).toBeNull();
    expect(access.blocked).toBe(true);
    expect(mockApi).not.toHaveBeenCalled();
    const offline = SessionAccess.restore({
      expectedUserId: user.id,
      offlineCredentials: credentials,
    });
    expect(offline.snapshot().offlineCredentials).toEqual(credentials);
    allow();
    await offline.ensure();
    expect(offline.snapshot().offlineCredentials).toBeUndefined();
    expect(offline.snapshot().authenticated?.token).toBe("token-one");
  });
});
