import { afterEach, expect, it, vi } from "vitest";
import { listenUpdates } from "../../src/live";
const encoder = new TextEncoder(),
  revision = "a".repeat(64);
afterEach(() => vi.unstubAllGlobals());
it("SSE lê eventos fragmentados e encerra o transporte ao sair sem token na URL", async () => {
  const abort = new AbortController();
  let cancelled = false;
  const updates: string[] = [];
  const transport = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        new ReadableStream({
          start(c) {
            for (const chunk of [
              ": heartbeat\n\nevent: up",
              'date\r\ndata: {"revision":"',
              revision,
              '"}\r\n\r\n',
            ])
              c.enqueue(encoder.encode(chunk));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
  );
  vi.stubGlobal("fetch", transport);
  await listenUpdates("private-token", abort.signal, async (r) => {
    updates.push(r);
    abort.abort();
  });
  expect(updates).toEqual([revision]);
  expect(cancelled).toBe(true);
  expect(transport.mock.calls[0]?.[0]).toBe("/api/v1/events");
});
it("evento de revogação pede renovação da sessão", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response("event: reauthenticate\ndata: {}\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      }),
  );
  await expect(
    listenUpdates("token", new AbortController().signal, async () => {}),
  ).rejects.toMatchObject({ status: 401 });
});
it("conexão interrompida e HTML de proxy não são tratados como atualização", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response("<html>proxy</html>", {
        headers: { "Content-Type": "text/html" },
      }),
  );
  await expect(
    listenUpdates("token", new AbortController().signal, async () => {}),
  ).rejects.toThrow("inválido");
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response("", { headers: { "Content-Type": "text/event-stream" } }),
  );
  await expect(
    listenUpdates("token", new AbortController().signal, async () => {}),
  ).rejects.toThrow("encerrado");
});
it("preserva Retry-After para a reconexão", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response("", { status: 429, headers: { "Retry-After": "60" } }),
  );
  await expect(
    listenUpdates("token", new AbortController().signal, async () => {}),
  ).rejects.toMatchObject({ status: 429, retryAfter: 60 });
});
