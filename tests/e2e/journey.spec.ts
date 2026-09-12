import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const fixture = () =>
  JSON.parse(readFileSync(".test-data/fixture.json", "utf8"));
async function studentLogin(page: Page, alias = "enzo") {
  const f = fixture();
  await page.getByLabel("Código da turma").fill(f.classroom.joinCode);
  await page.getByLabel("Seu apelido").fill(alias);
  await page.getByLabel("Seu PIN de 6 números").fill(f[alias].pin);
  await page
    .getByRole("button", {
      name: "Entrar e continuar",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: `Olá, ${alias === "enzo" ? "Enzo" : alias === "bia" ? "Bia" : "Lucas"}!`,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: fixture().mission.content.title })
      .getByRole("button"),
  ).toBeVisible();
}
async function teacherLogin(page: Page) {
  await page.getByRole("button", { name: "Sou professor" }).click();
  await page.getByLabel("Login do professor").fill(fixture().teacher.login);
  await page
    .getByLabel("Sua senha", { exact: true })
    .fill(fixture().teacher.password);
  await page
    .getByRole("button", { name: "Entrar e continuar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Olá, Prof.ª Maria!" }),
  ).toBeVisible();
}
async function openMission(page: Page) {
  await page
    .getByRole("article")
    .filter({ hasText: fixture().mission.content.title })
    .getByRole("button")
    .click();
  await expect(page.getByLabel("Produção da equipe")).toBeVisible();
}
test("aluno: rascunho offline sobrevive à recarga, sincroniza e não duplica", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await studentLogin(page);
  await openMission(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page
    .getByLabel("Produção da equipe")
    .fill("Comparamos três medições e propomos uma ação coletiva.");
  await expect(
    page.getByText("Salvo neste aparelho", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await studentLogin(page, "enzo");
  await openMission(page);
  await expect(page.getByLabel("Produção da equipe")).toHaveValue(
    "Comparamos três medições e propomos uma ação coletiva.",
  );
  await page
    .getByRole("button", { name: "Guardar para enviar", exact: true })
    .click();
  await expect(
    page.getByText("Aguardando envio", { exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  // No logout, navigation, manual retry or second login after the network returns.
  await expect(page.getByText("Sincronizado", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/student-mission.png",
    fullPage: true,
  });
});
test("troca de perfil e segunda aba não revelam rascunhos de outro aluno", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await studentLogin(page, "lucas");
  await openMission(page);
  await page
    .getByLabel("Produção da equipe")
    .fill("Rascunho exclusivo da Equipe Jatobá.");
  await expect(
    page.getByText("Salvo neste aparelho", { exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await second.getByLabel("Código da turma").fill(fixture().classroom.joinCode);
  await second.getByLabel("Seu apelido").fill("lucas");
  await second.getByLabel("Seu PIN de 6 números").fill(fixture().lucas.pin);
  await second
    .getByRole("button", { name: "Entrar e continuar", exact: true })
    .click();
  await expect(second.getByRole("alert")).toContainText("outra aba");
  await second.close();
  await page
    .getByRole("button", { name: "Sair ou trocar perfil" })
    .first()
    .click();
  await page.getByRole("button", { name: "Guardar e encerrar acesso" }).click();
  await studentLogin(page, "bia");
  await openMission(page);
  await expect(page.getByLabel("Produção da equipe")).not.toHaveValue(
    "Rascunho exclusivo da Equipe Jatobá.",
  );
});
test("professor revisa entrega real e aluno recebe reconhecimento e usa avatar do Stitch", async ({
  page,
  browser,
  request,
}) => {
  // This scenario can also run alone: prepare a real submission through the API when needed.
  const f = fixture();
  const auth = await request.post("/api/v1/auth/student-session", {
    data: { classCode: f.classroom.joinCode, alias: "enzo", pin: f.enzo.pin },
  });
  expect(auth.ok()).toBeTruthy();
  const headers = { authorization: `Bearer ${(await auth.json()).token}` };
  const submissions = await request.get(
    `/api/v1/missions/${f.mission.id}/submissions`,
    { headers },
  );
  if (!(await submissions.json()).items.length) {
    const prepared = await request.post("/api/v1/sync/submissions", {
      headers,
      data: {
        operationId: randomUUID(),
        submissionId: randomUUID(),
        missionId: f.mission.id,
        groupId: f.group.id,
        baseVersion: 0,
        evidence: "Comparamos três medições e propomos uma ação coletiva.",
        reflection: "",
        completedSteps: [],
        channel: "digital",
      },
    });
    expect(prepared.ok()).toBeTruthy();
  }
  await request.post("/api/v1/auth/logout", { headers });
  await page.goto("/");
  await teacherLogin(page);
  await page.screenshot({
    path: "test-results/teacher-dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ver entregas", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /Equipe Ipê.*Versão/ }).click();
  await expect(
    page.getByText("Comparamos três medições e propomos uma ação coletiva.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Uso de evidências", exact: true })
    .selectOption("2");
  await page
    .getByRole("combobox", { name: "Construção coletiva", exact: true })
    .selectOption("2");
  await page
    .getByLabel("Devolutiva para a equipe")
    .fill("Boa comparação. Na próxima etapa, expliquem os limites da medição.");
  await page
    .getByLabel("Reconhecer a participação de todos os integrantes")
    .check();
  await page.getByRole("button", { name: "Publicar devolutiva" }).click();
  await expect(
    page.getByText("Avaliação publicada", { exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const student = await context.newPage();
  await student.goto("http://127.0.0.1:4185");
  await studentLogin(student);
  await expect(
    student.getByRole("banner").getByText("100 XP", { exact: true }),
  ).toBeVisible();
  await student
    .getByRole("navigation", { name: "Navegação no celular" })
    .getByRole("link", { name: "Meu avatar" })
    .click();
  await expect(
    student.getByRole("img", { name: "Avatar ilustrado do EducaXP" }),
  ).toBeVisible();
  await student.getByRole("button", { name: "Usar este visual" }).click();
  await expect(
    student.getByText("Seu visual foi atualizado.", { exact: true }),
  ).toBeVisible();
  await student.getByRole("button", { name: "Fechar mensagem" }).click();
  await student.evaluate(() => window.scrollTo(0, 0));
  await student.screenshot({
    path: "test-results/avatar-mobile.png",
    fullPage: true,
  });
  await context.close();
});
test("professor publica uma missão revisada e organiza a turma", async ({
  page,
}) => {
  await page.goto("/");
  await teacherLogin(page);
  await page.getByRole("button", { name: "Criar missão" }).click();
  await page
    .getByLabel("Título da missão", { exact: true })
    .fill("Missão criada na interface");
  await page
    .getByLabel("Objetivo de aprendizagem")
    .fill("Comparar hipóteses e justificar a conclusão usando evidências.");
  await page.getByRole("button", { name: "Revisado, publicar missão" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Missão criada na interface",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Turma e grupos" })
    .click();
  await page.getByLabel("Nome de exibição").fill("Ana fictícia");
  await page.getByLabel("Apelido para entrar").fill("ana");
  await page.getByRole("button", { name: "Incluir na turma" }).click();
  await expect(page.getByRole("dialog")).toContainText("ana");
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page
    .getByLabel("Nome da equipe", { exact: true })
    .fill("Equipe Aurora");
  await page.getByLabel("Ana fictícia", { exact: true }).check();
  await page.getByRole("button", { name: "Formar equipe" }).click();
  await expect(
    page.getByRole("heading", { name: "Equipe Aurora" }),
  ).toBeVisible();
});
test("320 px, acessibilidade e assets locais: nenhuma requisição externa ou API em cache", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (req) => {
    if (
      !req.url().startsWith("http://127.0.0.1:4185") &&
      !req.url().startsWith("data:")
    )
      external.push(req.url());
  });
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/");
  await expect(page.locator(".brand img").first()).toHaveAttribute(
    "src",
    "/assets/educaxp-emblem.png",
  );
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 320);
  const loginAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(loginAudit.violations).toEqual([]);
  await studentLogin(page, "lucas");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 320);
  await page.screenshot({
    path: "test-results/student-320.png",
    fullPage: true,
  });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  const cachedUrls = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (key) =>
          (await (await caches.open(key)).keys()).map((req) => req.url),
        ),
      )
    ).flat(),
  );
  expect(
    cachedUrls.filter((url) => new URL(url).pathname.startsWith("/api/")),
  ).toEqual([]);
  // The host antivirus injects its own script into Edge. It is not an application asset.
  const antivirusRequests = external.filter((url) =>
    new URL(url).hostname.endsWith(".kaspersky-labs.com"),
  );
  if (antivirusRequests.length)
    test.info().annotations.push({
      type: "environment",
      description: `${antivirusRequests.length} requisições injetadas pelo antivírus do host; não originadas no código da PWA.`,
    });
  expect(external.filter((url) => !antivirusRequests.includes(url))).toEqual(
    [],
  );
});

test("duas cópias da equipe preservam as versões e permitem resolver conflito", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await studentLogin(page, "lucas");
  await openMission(page);
  const context = await browser.newContext();
  const second = await context.newPage();
  await second.goto("http://127.0.0.1:4185");
  await studentLogin(second, "lucas");
  await openMission(second);
  await second
    .getByLabel("Produção da equipe")
    .fill("Hipótese da segunda cópia.");
  await expect(
    second.getByText("Salvo neste aparelho", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Produção da equipe")
    .fill("Resultado enviado pela primeira cópia.");
  await page
    .getByRole("button", { name: "Enviar produção", exact: true })
    .click();
  await expect(page.getByText("Sincronizado", { exact: true })).toBeVisible();
  await second
    .getByRole("button", { name: "Enviar produção", exact: true })
    .click();
  await expect(
    second.getByRole("heading", { name: "Seu grupo enviou outra versão" }),
  ).toBeVisible();
  await expect(second.getByLabel("Produção da equipe")).toHaveValue(
    "Hipótese da segunda cópia.",
  );
  await expect(
    second.getByText("Resultado enviado pela primeira cópia.", { exact: true }),
  ).toBeVisible();
  await second
    .getByRole("button", { name: "Manter meu texto e preparar revisão" })
    .click();
  await second
    .getByLabel("Produção da equipe")
    .fill("Conclusão que reúne as duas contribuições.");
  await second
    .getByRole("button", { name: "Enviar produção", exact: true })
    .click();
  await expect(second.getByText("Sincronizado", { exact: true })).toBeVisible();
  await context.close();
});

test("sessão recusada durante envio é renovada e a mesma operação é retomada", async ({
  page,
}) => {
  let logins = 0;
  const operations: string[] = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/auth/student-session")) logins++;
  });
  await page.route("**/api/v1/sync/submissions", async (route) => {
    operations.push(route.request().postDataJSON().operationId);
    if (operations.length === 1)
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAUTHENTICATED", message: "Sessão expirada." },
        }),
      });
    else await route.continue();
  });
  await page.goto("/");
  await studentLogin(page, "lucas");
  await openMission(page);
  await page
    .getByLabel("Produção da equipe")
    .fill("Produção preservada durante a renovação de acesso.");
  await page
    .getByRole("button", { name: "Enviar produção", exact: true })
    .click();
  await expect(page.getByText("Sincronizado", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  expect(logins).toBe(2);
  expect(operations.length).toBe(2);
  expect(new Set(operations).size).toBe(1);
  await expect(page.getByLabel("Produção da equipe")).toHaveValue(
    "Produção preservada durante a renovação de acesso.",
  );
  await expect(
    page.getByRole("button", { name: "Entrar e continuar", exact: true }),
  ).toHaveCount(0);
});

test("servidor indisponível abre cópia local e retoma envio sem evento de rede", async ({
  page,
}) => {
  await page.goto("/");
  await studentLogin(page, "bia");
  await openMission(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.route("**/api/**", (route) => route.abort("failed"));
  await page.reload();
  await studentLogin(page, "bia");
  await openMission(page);
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  await page
    .getByLabel("Produção da equipe")
    .fill("Trabalho criado enquanto somente o servidor estava indisponível.");
  await page
    .getByRole("button", { name: "Guardar para enviar", exact: true })
    .click();
  await expect(
    page.getByText("Aguardando envio", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/**");
  await expect(page.getByText("Sincronizado", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page.getByRole("button", { name: "Entrar e continuar", exact: true }),
  ).toHaveCount(0);
});

test("assistente: proposta simulada, ajustes, revisão e recuperação offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await teacherLogin(page);
  await page.getByRole("button", { name: "Criar missão" }).click();
  const title = page.getByLabel("Título da missão", { exact: true });
  await title.fill("Meu rascunho preservado");
  await page
    .getByLabel("Recursos disponíveis")
    .fill("Um celular por equipe, papel e encartes de mercado.");
  await page
    .getByLabel("Pedido para o assistente")
    .fill("Crie uma investigação sobre descontos.");
  await page.getByRole("button", { name: "Criar com IA", exact: true }).click();
  const proposal = page.getByRole("article", { name: "Proposta para revisão" });
  await expect(proposal).toContainText(
    "Mercado colaborativo: proposta de teste",
  );
  await expect(title).toHaveValue("Meu rascunho preservado");
  await page
    .getByLabel("Pedido para o assistente")
    .fill("Adapte para equipes que compartilham um aparelho.");
  await page.getByRole("button", { name: "Pedir ajuste", exact: true }).click();
  await expect(proposal).toContainText("Mercado colaborativo: versão ajustada");
  await expect(title).toHaveValue("Meu rascunho preservado");
  const audit = await new AxeBuilder({ page })
    .include(".assistant-panel")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page
    .locator(".assistant-panel")
    .screenshot({ path: "test-results/assistant-desktop.png" });
  await page.setViewportSize({ width: 320, height: 780 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 320);
  await page
    .locator(".assistant-panel")
    .screenshot({ path: "test-results/assistant-mobile.png" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await teacherLogin(page);
  await page.getByRole("button", { name: "Criar missão" }).click();
  await expect(proposal).toContainText("Mercado colaborativo: versão ajustada");
  await expect(title).toHaveValue("Meu rascunho preservado");
  await expect(
    page.getByRole("button", { name: "Pedir ajuste", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Aplicar proposta ao rascunho" })
    .click();
  await expect(title).toHaveValue("Mercado colaborativo: versão ajustada");
  await expect(proposal).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revisado, publicar missão" }),
  ).toBeDisabled();
  await context.setOffline(false);
  await expect(
    page.getByText("Assistente disponível", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revisado, publicar missão" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Mercado colaborativo: versão ajustada",
      exact: true,
    }),
  ).toBeVisible();
});

test("assistente desativado mantém pedido e editor disponíveis", async ({
  page,
}) => {
  await page.route("**/api/v1/planning/assistant/status", (route) =>
    route.fulfill({ json: { enabled: false } }),
  );
  await page.goto("/");
  await teacherLogin(page);
  await page.getByRole("button", { name: "Criar missão" }).click();
  await expect(
    page.getByText("Aguardando ativação", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Pedido para o assistente")
    .fill("Pedido que fica preparado no aparelho.");
  await expect(
    page.getByRole("button", { name: "Criar com IA", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Título da missão", { exact: true })
    .fill("Planejamento sem IA");
  await expect(
    page.getByLabel("Título da missão", { exact: true }),
  ).toHaveValue("Planejamento sem IA");
});
