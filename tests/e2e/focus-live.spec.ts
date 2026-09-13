import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const fixture = () =>
  JSON.parse(readFileSync(".test-data/fixture.json", "utf8"));
async function studentLogin(page: Page) {
  const f = fixture();
  await page.getByLabel("Código da turma").fill(f.classroom.joinCode);
  await page.getByLabel("Seu apelido").fill("caio");
  await page.getByLabel("Seu PIN de 6 números").fill(f.caio.pin);
  await page
    .getByRole("button", { name: "Entrar e continuar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Olá, Caio!" }),
  ).toBeVisible();
}
async function open(page: Page, title: string) {
  await page
    .getByRole("article")
    .filter({ hasText: title })
    .getByRole("button")
    .click();
  await expect(page.getByLabel("Produção da equipe")).toBeVisible();
}
test("foco offline e atualização entre professor e aluno preservam rascunhos e concedem XP uma vez", async ({
  page,
  context,
  browser,
  request,
}) => {
  test.setTimeout(120000);
  const f = fixture();
  let polling = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/v1/updates") polling++;
  });
  const connected = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/events") && r.status() === 200,
  );
  await page.goto("/");
  await studentLogin(page);
  await connected;
  const login = await request.post("/api/v1/auth/login", { data: f.teacher });
  // The fixture uses password in its teacher object, matching the API contract.
  expect(login.ok()).toBeTruthy();
  const headers = { authorization: "Bearer " + (await login.json()).token };
  const title = "Foco e atualização: investigação da equipe";
  const created = await request.post(
    "/api/v1/classrooms/" + f.classroom.id + "/missions",
    { headers, data: { ...f.mission.content, title } },
  );
  expect(created.ok()).toBeTruthy();
  const mission = await created.json();
  await request.patch("/api/v1/missions/" + mission.id + "/status", {
    headers,
    data: { status: "published", baseVersion: 1 },
  });
  await expect(
    page.getByRole("article").filter({ hasText: title }),
  ).toBeVisible({ timeout: 15000 });
  const teacherContext = await browser.newContext();
  try {
    const teacher = await teacherContext.newPage();
    await teacher.goto("/");
    await teacher.getByRole("button", { name: "Sou professor" }).click();
    await teacher.getByLabel("Login do professor").fill(f.teacher.login);
    await teacher
      .getByLabel("Sua senha", { exact: true })
      .fill(f.teacher.password);
    await teacher
      .getByRole("button", { name: "Entrar e continuar", exact: true })
      .click();
    await expect(
      teacher.getByRole("heading", { name: "Olá, Prof.ª Maria!" }),
    ).toBeVisible();
    await teacher.goto("/#/review/" + mission.id);
    await open(page, title);
    await page
      .getByLabel("Produção da equipe")
      .fill("Primeira hipótese que ficará preservada.");
    await page
      .getByRole("button", { name: "Preparar nosso combinado" })
      .click();
    await page
      .getByLabel("Nosso objetivo neste ciclo")
      .fill("Comparar duas hipóteses sobre o consumo de água");
    await page.getByRole("button", { name: "Iniciar cronômetro" }).click();
    const audit = await new AxeBuilder({ page })
      .include(".focus-card")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await context.setOffline(true);
    await page.reload();
    await studentLogin(page);
    await open(page, title);
    await expect(page.getByLabel("Nosso objetivo neste ciclo")).toHaveValue(
      "Comparar duas hipóteses sobre o consumo de água",
    );
    await expect(page.getByLabel("Produção da equipe")).toHaveValue(
      "Primeira hipótese que ficará preservada.",
    );
    await page
      .getByLabel("O que ajudou a equipe? O que podemos ajustar?")
      .fill("Revezar a fala ajudou a comparar nossas ideias.");
    await page
      .getByRole("button", { name: "Guardar reflexão para enviar" })
      .click();
    await expect(
      page.getByText("Reflexão salva · aguardando envio para confirmar o XP"),
    ).toBeVisible();
    await context.setOffline(false);
    await expect(
      page.getByText(
        "Combinado registrado · bônus de 25 XP por integrante reconhecido",
      ),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      teacher.getByText("Revezar a fala ajudou a comparar nossas ideias.", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("Produção da equipe")).toHaveValue(
      "Primeira hipótese que ficará preservada.",
    );
    await page
      .getByRole("button", { name: "Enviar produção", exact: true })
      .click();
    await expect(
      teacher.getByRole("button", { name: /Equipe Cedro.*Versão 1/ }),
    ).toBeVisible({ timeout: 15000 });
    await teacher
      .getByRole("button", { name: /Equipe Cedro.*Versão 1/ })
      .click();
    await teacher
      .getByLabel("Devolutiva para a equipe")
      .fill("Minha devolutiva ainda em edição.");
    await expect(page.getByText("Sincronizado", { exact: true })).toBeVisible();
    await page
      .getByLabel("Produção da equipe")
      .fill("Segunda hipótese: comparamos os dois resultados.");
    await page
      .getByRole("button", { name: "Enviar produção", exact: true })
      .click();
    await expect(
      teacher.getByText(/A equipe enviou uma nova versão/),
    ).toBeVisible({ timeout: 15000 });
    await expect(teacher.getByLabel("Devolutiva para a equipe")).toHaveValue(
      "Minha devolutiva ainda em edição.",
    );
    await teacher
      .getByRole("button", { name: /Equipe Cedro.*Versão 2/ })
      .click();
    await expect(
      teacher.getByText("Revisando versão 2", { exact: true }),
    ).toBeVisible();
    for (const criterion of f.mission.content.rubric)
      await teacher
        .getByRole("combobox", { name: criterion.title, exact: true })
        .selectOption("2");
    await teacher
      .getByLabel("Devolutiva para a equipe")
      .fill("A comparação das hipóteses ficou clara. Boa investigação!");
    await teacher.getByRole("button", { name: "Publicar devolutiva" }).click();
    await expect(
      teacher.getByText("Avaliação publicada", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "A comparação das hipóteses ficou clara. Boa investigação!",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 15000 });
    await teacher.goto("/#/");
    await teacher.getByRole("button", { name: "Combinar uma pausa" }).click();
    await expect(
      page.getByText(
        "A turma combinou uma pausa. Descansem e retomem quando estiverem prontos.",
      ),
    ).toBeVisible({ timeout: 15000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await page.screenshot({
      path: "test-results/focus-live.png",
      fullPage: true,
    });
    const auth = await request.post("/api/v1/auth/student-session", {
      data: {
        classCode: f.classroom.joinCode,
        alias: "caio",
        pin: f.caio.pin,
      },
    });
    const avatar = await request.get("/api/v1/me/avatar", {
      headers: { authorization: "Bearer " + (await auth.json()).token },
    });
    expect((await avatar.json()).xp).toBe(25);
    expect(polling).toBe(0);
    await teacher.getByRole("button", { name: "Retomar a atividade" }).click();
  } finally {
    await teacherContext.close();
    await request.post("/api/v1/auth/logout", { headers });
  }
});
