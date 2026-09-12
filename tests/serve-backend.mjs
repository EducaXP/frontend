import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const backendRoot = resolve(process.env.EDUCAXP_BACKEND_PATH || "../backend");
const { buildApp } = await import(
  pathToFileURL(join(backendRoot, "dist/app.js")).href
);
const { hashPassword, issueSession } = await import(
  pathToFileURL(join(backendRoot, "dist/auth.js")).href
);
const { planningTemplate } = await import(
  pathToFileURL(join(backendRoot, "dist/planning.js")).href
);
const { createPlanningAgent } = await import(
  pathToFileURL(join(backendRoot, "dist/ai.js")).href
);
mkdirSync(".test-data", { recursive: true });
const directory = mkdtempSync(resolve(".test-data/run-"));
const { Store } = await import(
  pathToFileURL(join(backendRoot, "dist/db.js")).href
);
const { createRequire } = await import("node:module");
const resolver = createRequire(join(backendRoot, "package.json"));
const { PGlite } = await import(
  pathToFileURL(resolver.resolve("@electric-sql/pglite")).href
);
const embedded = new PGlite(join(directory, "postgres"));
let tail = Promise.resolve();
const store = new Store({
  async connect() {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    return {
      release,
      async query(sql, values = []) {
        if (!values.length && sql.includes(";")) {
          const result = (await embedded.exec(sql)).at(-1);
          return { rows: result?.rows || [], rowCount: result?.affectedRows };
        }
        const result = await embedded.query(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows };
      },
    };
  },
  async end() {
    await embedded.close();
  },
});
await store.migrate();
const { app, db } = await buildApp({
  store,
  rateLimitMax: 5000,
  // Exercise the real adapter; only its HTTP transport is simulated, with fictitious data.
  planningAgent: createPlanningAgent(
    {
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "fixture/model",
      apiKey: "test-only-key",
    },
    async (_url, init) => {
      const context = JSON.parse(JSON.parse(init.body).messages[1].content);
      const proposal = {
        reply:
          "Proposta simulada para teste: revise a investigação e a rubrica.",
        content: {
          ...planningTemplate({ ...context, theme: "preços de mercado" }),
          questions: (context.topics?.length
            ? context.topics
            : ["Porcentagem", "Comparação"]
          ).map((topic, i) => ({
            id: "q" + i,
            topic,
            prompt:
              "Que evidência explica " +
              topic +
              "? Justifiquem com um exemplo.",
          })),
          title: context.history?.length
            ? "Mercado colaborativo: versão ajustada"
            : "Mercado colaborativo: proposta de teste",
        },
      };
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(proposal) },
          },
        ],
      });
    },
  ),
});
const schoolId = randomUUID(),
  teacherId = randomUUID();
await db.run(
  "INSERT INTO schools VALUES($1,$2)",
  schoolId,
  "Escola de testes fictícia",
);
await db.run(
  "INSERT INTO users(id,school_id,role,name,login,password_hash) VALUES($1,$2,$3,$4,$5,$6)",
  teacherId,
  schoolId,
  "teacher",
  "Prof.ª Maria",
  "qa.maria",
  await hashPassword("qa-password-123"),
);
const token = (await issueSession(db, teacherId, 12)).token;
const send = async (path, payload, method = "POST") => {
  const response = await app.inject({
    method,
    url: `/api/v1${path}`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
  if (response.statusCode >= 400) throw new Error(response.body);
  return response.json();
};
const classroom = await send("/classrooms", { name: "9º ano A · Matemática" });
const enzo = await send(`/classrooms/${classroom.id}/students`, {
  name: "Enzo",
  alias: "enzo",
});
const bia = await send(`/classrooms/${classroom.id}/students`, {
  name: "Bia",
  alias: "bia",
});
const lucas = await send(`/classrooms/${classroom.id}/students`, {
  name: "Lucas",
  alias: "lucas",
});
const group = await send(`/classrooms/${classroom.id}/groups`, {
  name: "Equipe Ipê",
  members: [
    { studentId: enzo.id, role: "Investigar" },
    { studentId: bia.id, role: "Registrar" },
  ],
});
await send(`/classrooms/${classroom.id}/groups`, {
  name: "Equipe Jatobá",
  members: [{ studentId: lucas.id, role: "Apresentar" }],
});
const mission = await send(`/classrooms/${classroom.id}/missions`, {
  ...planningTemplate({
    theme: "consumo de água na escola",
    subject: "Matemática",
    schoolYear: "9º ano",
    durationMinutes: 30,
  }),
  title: "Laboratório da água: cada gota conta",
});
await send(
  `/missions/${mission.id}/status`,
  { status: "published", baseVersion: 1 },
  "PATCH",
);
writeFileSync(
  ".test-data/fixture.json",
  JSON.stringify({
    teacher: { login: "qa.maria", password: "qa-password-123" },
    classroom,
    enzo,
    bia,
    lucas,
    group,
    mission,
  }),
);
await app.listen({ host: "127.0.0.1", port: 4319 });
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, async () => {
    await app.close();
    process.exit();
  });
