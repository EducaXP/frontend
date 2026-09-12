import { api, ApiError } from "./api";
import type { Credentials, User } from "./types";

interface Authenticated {
  token: string;
  expiresAt: number;
  user: User;
}

// Runtime-only credentials: never include this object in the persisted Workspace.
export class SessionAccess {
  private credentials: Credentials | null;
  private authenticated: Authenticated | null = null;
  private pending: Promise<Authenticated | null> | null = null;
  private retryAt = 0;
  private attempts = 0;
  failure: ApiError | null = null;
  blocked = false;
  constructor(
    credentials: Credentials,
    private expectedUserId?: string,
  ) {
    this.credentials = { ...credentials };
  }
  ensure(): Promise<Authenticated | null> {
    if (!this.credentials || this.blocked) return Promise.resolve(null);
    if (this.pending) return this.pending;
    if (this.authenticated && this.authenticated.expiresAt > Date.now() + 1000)
      return Promise.resolve(this.authenticated);
    if (Date.now() < this.retryAt) return Promise.resolve(null);
    this.pending = this.connect().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  private async connect(): Promise<Authenticated | null> {
    const credentials = this.credentials!;
    let issued: string | null = null;
    try {
      const payload =
        credentials.role === "teacher"
          ? { login: credentials.login, password: credentials.secret }
          : {
              classCode: credentials.classCode,
              alias: credentials.alias,
              pin: credentials.secret,
            };
      const result = await api<{ token: string; expiresAt: string }>(
        credentials.role === "teacher"
          ? "/auth/login"
          : "/auth/student-session",
        null,
        "POST",
        payload,
        4000,
      );
      issued = result.token;
      const user = await api<User>("/me", result.token, "GET", undefined, 4000);
      if (this.expectedUserId && user.id !== this.expectedUserId)
        throw new ApiError(
          403,
          "PROFILE_MISMATCH",
          "O acesso corresponde a outro perfil. Seus rascunhos continuam protegidos.",
        );
      if (!this.credentials) {
        void api("/auth/logout", issued, "POST").catch(() => {});
        return null;
      }
      const previous = this.authenticated?.token;
      this.expectedUserId = user.id;
      this.authenticated = {
        token: result.token,
        expiresAt: Date.parse(result.expiresAt),
        user,
      };
      this.failure = null;
      this.attempts = 0;
      this.retryAt = 0;
      if (previous && previous !== issued)
        void api("/auth/logout", previous, "POST").catch(() => {});
      return this.authenticated;
    } catch (error) {
      if (issued) void api("/auth/logout", issued, "POST").catch(() => {});
      if (!this.credentials) return null;
      this.failure =
        error instanceof ApiError
          ? error
          : new ApiError(
              0,
              "NETWORK_ERROR",
              "Não foi possível confirmar o acesso.",
            );
      this.blocked =
        this.failure.status >= 400 &&
        this.failure.status < 500 &&
        this.failure.status !== 429;
      this.attempts++;
      this.retryAt =
        Date.now() +
        Math.max(
          this.failure.retryAfter * 1000,
          Math.min(60000, 2000 * 2 ** Math.min(this.attempts, 5)),
        );
      return null;
    }
  }
  invalidate(token: string | null) {
    if (this.authenticated?.token === token) this.authenticated = null;
  }
  close() {
    const token = this.authenticated?.token;
    this.credentials = null;
    this.authenticated = null;
    if (token) void api("/auth/logout", token, "POST").catch(() => {});
  }
}
