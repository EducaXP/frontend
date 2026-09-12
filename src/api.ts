export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  token: string | null,
  method = "GET",
  body?: unknown,
  timeoutMs = 12000,
): Promise<T> {
  if (token === null && !path.startsWith("/auth/"))
    throw new ApiError(
      401,
      "REAUTHENTICATE",
      "Aguardando conexão para confirmar seu acesso.",
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/v1${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        data.error?.code || "HTTP_ERROR",
        data.error?.message || "O servidor não pôde concluir. Tente novamente.",
        data.error?.details,
        Number(response.headers.get("Retry-After")) || 0,
      );
    }
    return response.status === 204 ? (undefined as T) : await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Sem conexão com o servidor. Seu trabalho local será preservado.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
export async function list<T>(path: string, token: string) {
  const all: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api<{ items: T[] }>(
      `${path}?limit=100&offset=${offset}`,
      token,
    );
    all.push(...page.items);
    if (page.items.length < 100) return all;
  }
}
