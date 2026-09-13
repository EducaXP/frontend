import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = () =>
  JSON.parse(readFileSync(".test-data/fixture.json", "utf8"));
async function login(page: Page) {
  const f = fixture();
  await page.getByLabel("Código da turma").fill(f.classroom.joinCode);
  await page.getByLabel("Seu apelido").fill("enzo");
  await page.getByLabel("Seu PIN de 6 números").fill(f.enzo.pin);
  await page
    .getByRole("button", { name: "Entrar e continuar", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Olá, Enzo!" })).toBeVisible();
}
async function open(page: Page) {
  await page
    .getByRole("article")
    .filter({ hasText: fixture().mission.content.title })
    .getByRole("button")
    .click();
  await expect(page.getByLabel("Produção da equipe")).toBeVisible();
}
async function logout(page: Page) {
  await page
    .getByRole("button", { name: "Sair ou trocar perfil" })
    .first()
    .click();
  await page
    .getByRole("button", {
      name: /^(Guardar e encerrar acesso|Encerrar acesso)$/,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Entrar e continuar", exact: true }),
  ).toBeVisible();
}
test("recarga mantém tela e rascunhos, isola abas e sincroniza após restaurar login offline", async ({
  page,
  context,
}) => {
  let logins = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/auth/student-session")) logins++;
  });
  await page.goto("/");
  await login(page);
  await open(page);
  const route = page.url();
  await page.reload();
  await expect(page.getByLabel("Produção da equipe")).toBeVisible();
  expect(page.url()).toBe(route);
  expect(logins).toBe(1);
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    other.getByRole("button", { name: "Entrar e continuar", exact: true }),
  ).toBeVisible();
  // Duplicating a tab copies sessionStorage in some browsers. The profile lock still wins.
  const handle = await page.evaluate(() =>
    sessionStorage.getItem("educaxp-tab-session-v1")!,
  );
  await other.evaluate(
    (handle) => sessionStorage.setItem("educaxp-tab-session-v1", handle),
    handle,
  );
  await other.reload();
  await expect(other.getByRole("alert")).toContainText("outra aba");
  await other.close();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page
    .getByLabel("Produção da equipe")
    .fill("Investigação preservada ao atualizar sem conexão.");
  await expect(
    page.getByText("Salvo neste aparelho", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Produção da equipe")).toHaveValue(
    "Investigação preservada ao atualizar sem conexão.",
  );
  await logout(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Entrar e continuar", exact: true }),
  ).toBeVisible();
  // A PIN-unlocked offline login has no token yet; reload must preserve automatic reconnection.
  await login(page);
  await open(page);
  await page.reload();
  await expect(page.getByLabel("Produção da equipe")).toHaveValue(
    "Investigação preservada ao atualizar sem conexão.",
  );
  await page
    .getByRole("button", { name: "Guardar para enviar", exact: true })
    .click();
  await context.setOffline(false);
  await expect(page.getByText("Sincronizado", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await logout(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Entrar e continuar", exact: true }),
  ).toBeVisible();
});
test("token revogado não restaura acesso online e conserva os dados locais", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/auth/student-session") && r.status() === 200,
  );
  await login(page);
  const { token } = await (await response).json();
  await open(page);
  await page
    .getByLabel("Produção da equipe")
    .fill("Rascunho preservado após revogação.");
  await expect(
    page.getByText("Salvo neste aparelho", { exact: true }),
  ).toBeVisible();
  const revoked = await request.post("/api/v1/auth/logout", {
    headers: { authorization: "Bearer " + token },
  });
  expect(revoked.ok()).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Entrar e continuar", exact: true }),
  ).toBeVisible();
  await login(page);
  await open(page);
  await expect(page.getByLabel("Produção da equipe")).toHaveValue(
    "Rascunho preservado após revogação.",
  );
});
test("professor retoma a rota de planejamento com o token existente", async ({
  page,
}) => {
  let logins = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/auth/login")) logins++;
  });
  await page.goto("/");
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
  await page
    .getByRole("link", { name: "Planejamento", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp("#/planning$"));
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sair ou trocar perfil" }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp("#/planning$"));
  expect(logins).toBe(1);
});
