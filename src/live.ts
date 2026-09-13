import { ApiError } from "./api";
// fetch streaming keeps the bearer token out of URLs, logs and persistent storage.
export async function listenUpdates(
  token: string,
  signal: AbortSignal,
  onUpdate: (revision: string) => Promise<void>,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  let watchdog: ReturnType<typeof setTimeout>;
  const touch = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(abort, 45000);
  };
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    touch();
    const response = await fetch("/api/v1/events", {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "text/event-stream",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok)
      throw new ApiError(
        response.status,
        "LIVE_UNAVAILABLE",
        "Não foi possível conectar às atualizações.",
        undefined,
        Number(response.headers.get("Retry-After")) || 0,
      );
    if (
      !response.body ||
      !response.headers.get("Content-Type")?.includes("text/event-stream")
    )
      throw new Error("Canal de atualizações inválido.");
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) throw new Error("Canal de atualizações encerrado.");
      touch();
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 65536) throw new Error("Evento excedeu o limite.");
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const lines = frame.split(/\r?\n/);
        const event = lines
          .find((l) => l.startsWith("event:"))
          ?.slice(6)
          .trim();
        if (event === "reauthenticate")
          throw new ApiError(401, "REAUTHENTICATE", "Renovando seu acesso.");
        if (event !== "update") continue;
        const data = JSON.parse(
          lines
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trimStart())
            .join("\n"),
        );
        if (
          typeof data.revision !== "string" ||
          !/^[a-f0-9]{64}$/.test(data.revision)
        )
          throw new Error("Revisão inválida.");
        if (!signal.aborted) await onUpdate(data.revision);
      }
    }
  } finally {
    clearTimeout(watchdog!);
    signal.removeEventListener("abort", abort);
    controller.abort();
    await reader?.cancel().catch(() => {});
  }
}
