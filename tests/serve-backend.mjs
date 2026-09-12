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
mkdirSync(".test-data", { recursive: true });
const directory = mkdtempSync(resolve(".test-data/run-"));
const { app, db } = await buildApp({
  databasePath: join(directory, "qa.db"),
  rateLimitMax: 5000,
});
const schoolId = randomUUID(),
  teacherId = randomUUID();
db.run(
  "INSERT INTO schools VALUES(?,?)",
  schoolId,
  "Escola de testes fictícia",
);
db.run(
  "INSERT INTO users(id,school_id,role,name,login,password_hash) VALUES(?,?,?,?,?,?)",
  teacherId,
  schoolId,
  "teacher",
  "Prof.ª Maria",
  "qa.maria",
  await hashPassword("qa-password-123"),
);
const token = issueSession(db, teacherId, 12).token;
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
