import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const fixture = () =>
  JSON.parse(readFileSync(".test-data/fixture.json", "utf8"));
const travel = JSON.parse(
  readFileSync("../backend/test/fixtures/travel.json", "utf8"),
);
test("professor revisa desafio gerado e aluno resolve com dados e tabela disponíveis offline", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  const f = fixture();
  await page.goto("/");
  await page.getByRole("button", { name: "Sou professor" }).click();
  await page.getByLabel("Login do professor").fill(f.teacher.login);
  await page.getByLabel("Sua senha", { exact: true }).fill(f.teacher.password);
  await page
    .getByRole("button", { name: "Entrar e continuar", exact: true })
    .click();
  await page.getByRole("button", { name: "Criar missão", exact: true }).click();
  await page
    .getByLabel("Tópicos da investigação (um por linha)")
    .fill(travel.questions.map((q: { topic: string }) => q.topic).join("\n"));
  await page
    .getByLabel("Recursos disponíveis")
    .fill(
      "Calculadora, papel e lápis, celular com internet; planilha opcional.",
    );
  await page
    .getByLabel("Pedido para o assistente")
    .fill(
      "Crie uma atividade de viagem fictícia para quatro pessoas por três dias com R$ 4.000. Comparem pelo menos duas opções e justifiquem matematicamente o custo-benefício. Inclua dados suficientes para trabalhar sem internet.",
    );
  const request = page.waitForRequest(
    (r) => r.url().endsWith("/planning/assistant") && r.method() === "POST",
  );
  await page.getByRole("button", { name: "Criar com IA", exact: true }).click();
  const sent = (await request).postDataJSON();
  expect(sent.topics).toHaveLength(5);
  expect(sent.subject).toBe("Matemática");
  expect(sent.schoolYear).toBe("9º ano");
  const proposal = page.getByRole("article", { name: "Proposta para revisão" });
  await expect(
    proposal.getByRole("region", { name: "Desafio da equipe", exact: true }),
  ).toBeVisible();
  await expect(proposal.getByRole("table")).toContainText(
    "Alimentação por pessoa/dia (R$)",
  );
  await expect(proposal).toContainText("10%");
  await page
    .getByRole("button", { name: "Aplicar proposta ao rascunho" })
    .click();
  await page
    .getByLabel("Pergunta central do desafio", { exact: true })
    .fill("Que viagem a nossa equipe escolherá com R$ 4.000?");
  await page
    .getByLabel("Linha 1, Transporte do grupo, ida e volta (R$)", {
      exact: true,
    })
    .fill("1.250,00");
  await page.setViewportSize({ width: 320, height: 780 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 320);
  const editorAudit = await new AxeBuilder({ page })
    .include(".challenge-editor")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(editorAudit.violations).toEqual([]);
  await expect(page.getByText("Rascunho local", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Pergunta central do desafio", { exact: true }),
  ).toHaveValue("Que viagem a nossa equipe escolherá com R$ 4.000?");
  await expect(
    page.getByLabel("Linha 1, Transporte do grupo, ida e volta (R$)", {
      exact: true,
    }),
  ).toHaveValue("1.250,00");
  await page.getByRole("button", { name: "Revisado, publicar missão" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Desafio: Qual viagem cabe no orçamento?",
      exact: true,
    }),
  ).toBeVisible();
  const studentContext = await browser.newContext({
    viewport: { width: 320, height: 780 },
  });
  try {
    const student = await studentContext.newPage();
    await student.goto("http://127.0.0.1:4185/");
    await student.getByLabel("Código da turma").fill(f.classroom.joinCode);
    await student.getByLabel("Seu apelido").fill("caio");
    await student.getByLabel("Seu PIN de 6 números").fill(f.caio.pin);
    await student
      .getByRole("button", { name: "Entrar e continuar", exact: true })
      .click();
    await student
      .getByRole("article")
      .filter({ hasText: "Desafio: Qual viagem cabe no orçamento?" })
      .getByRole("button")
      .click();
    const brief = student.getByRole("region", {
      name: "Desafio da equipe",
      exact: true,
    });
    await expect(brief).toContainText(
      "Que viagem a nossa equipe escolherá com R$ 4.000?",
    );
    await expect(brief.getByRole("table")).toContainText("1.250,00");
    await expect(student.locator("body")).toHaveJSProperty("scrollWidth", 320);
    expect(
      (
        await new AxeBuilder({ page: student })
          .include(".challenge-brief")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    const tableScroll = brief.getByRole("region", {
      name: "Preços fictícios para a investigação",
    });
    await tableScroll.focus();
    await student.keyboard.press("ArrowRight");
    await expect
      .poll(() => tableScroll.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    await tableScroll.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await brief.screenshot({ path: "test-results/challenge-mobile.png" });
    await student.setViewportSize({ width: 1280, height: 900 });
    await brief.screenshot({ path: "test-results/challenge-desktop.png" });
    await student.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await studentContext.setOffline(true);
    await student.reload();
    await expect(brief.getByRole("table")).toContainText("1.250,00");
    await student
      .getByLabel("Resposta à questão 1", { exact: true })
      .fill(
        "O desconto é calculado sobre as duas diárias, e não sobre a viagem inteira.",
      );
    await expect(
      student.getByRole("button", { name: "Guardar para enviar", exact: true }),
    ).toBeDisabled();
    for (let i = 2; i <= 5; i++)
      await student
        .getByLabel("Resposta à questão " + i, { exact: true })
        .fill(
          "Resposta fictícia da questão " +
            i +
            ": registramos os cálculos e justificamos a escolha usando os dados do desafio.",
        );
    await student
      .getByRole("button", { name: "Guardar para enviar", exact: true })
      .click();
    await expect(
      student.getByText("Aguardando envio", { exact: true }),
    ).toBeVisible();
    await studentContext.setOffline(false);
    await expect(
      student.getByText("Sincronizado", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
  } finally {
    await studentContext.close();
  }
});
