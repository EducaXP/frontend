import { api, ApiError } from "./api";
import type { Credentials, User } from "./types";

export interface Authenticated {
  token: string;
  expiresAt: number;
  user: User;
}

export interface AccessSnapshot {
  expectedUserId: string;
  authenticated?: Authenticated;
  offlineCredentials?: Credentials;
}
// Credentials never enter Workspace. Offline-only restoration uses the encrypted tab capsule.
export class SessionAccess {
  private credentials: Credentials | null;
  private closed = false;
  private verifyRestored = false;
  private authenticated: Authenticated | null = null;
  private pending: Promise<Authenticated | null> | null = null;
  private retryAt = 0;
  private attempts = 0;
  failure: ApiError | null = null;
  blocked = false;
  constructor(
    credentials: Credentials | null,
    private expectedUserId?: string,
  ) {
    this.credentials = credentials ? { ...credentials } : null;
  }
  snapshot(): AccessSnapshot {
    if (!this.expectedUserId || this.closed)
      throw new Error("Acesso encerrado.");
    return this.authenticated
      ? {
          expectedUserId: this.expectedUserId,
          authenticated: this.authenticated,
        }
      : {
          expectedUserId: this.expectedUserId,
          ...(this.credentials
            ? { offlineCredentials: { ...this.credentials } }
            : {}),
        };
  }
  static restore(snapshot: AccessSnapshot) {
    const access = new SessionAccess(
      snapshot.offlineCredentials || null,
      snapshot.expectedUserId,
    );
    access.authenticated = snapshot.authenticated || null;
    access.verifyRestored = !!snapshot.authenticated;
    return access;
  }
  ensure(): Promise<Authenticated | null> {
    if (this.closed || this.blocked) return Promise.resolve(null);
    if (this.pending) return this.pending;
    if (
      !this.verifyRestored &&
      this.authenticated &&
      this.authenticated.expiresAt > Date.now() + 1000
    )
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
      let result: { token: string; expiresAt: string };
      if (credentials) {
        const payload =
          credentials.role === "teacher"
            ? { login: credentials.login, password: credentials.secret }
            : {
                classCode: credentials.classCode,
                alias: credentials.alias,
                pin: credentials.secret,
              };
        result = await api(
          credentials.role === "teacher"
            ? "/auth/login"
            : "/auth/student-session",
          null,
          "POST",
          payload,
          4000,
        );
        issued = result.token;
      } else {
        if (!this.authenticated || this.authenticated.expiresAt <= Date.now())
          throw new ApiError(
            401,
            "SESSION_EXPIRED",
            "Seu acesso expirou. Entre novamente; os rascunhos continuam protegidos.",
          );
        result = {
          token: this.authenticated.token,
          expiresAt: new Date(this.authenticated.expiresAt).toISOString(),
        };
      }
      const user = await api<User>("/me", result.token, "GET", undefined, 4000);
      if (this.expectedUserId && user.id !== this.expectedUserId)
        throw new ApiError(
          403,
          "PROFILE_MISMATCH",
          "O acesso corresponde a outro perfil. Seus rascunhos continuam protegidos.",
        );
      if (this.closed) {
        if (issued) void api("/auth/logout", issued, "POST").catch(() => {});
        return null;
      }
      const previous = this.authenticated?.token;
      this.expectedUserId = user.id;
      this.authenticated = {
        token: result.token,
        expiresAt: Date.parse(result.expiresAt),
        user,
      };
      this.verifyRestored = false;
      this.failure = null;
      this.attempts = 0;
      this.retryAt = 0;
      if (issued && previous && previous !== issued)
        void api("/auth/logout", previous, "POST").catch(() => {});
      return this.authenticated;
    } catch (error) {
      if (issued) void api("/auth/logout", issued, "POST").catch(() => {});
      if (this.closed) return null;
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
  bindUser(userId: string) {
    if (
      (this.expectedUserId && this.expectedUserId !== userId) ||
      (this.authenticated && this.authenticated.user.id !== userId)
    )
      throw new ApiError(
        403,
        "PROFILE_MISMATCH",
        "O acesso corresponde a outro perfil. Seus rascunhos continuam protegidos.",
      );
    this.expectedUserId = userId;
  }
  invalidate(token: string | null) {
    if (this.authenticated?.token === token) {
      if (this.credentials) this.authenticated = null;
      else this.verifyRestored = true;
    }
  }
  close(revoke = true) {
    this.closed = true;
    const token = this.authenticated?.token;
    this.credentials = null;
    this.authenticated = null;
    if (revoke && token)
      void api("/auth/logout", token, "POST").catch(() => {});
  }
}
