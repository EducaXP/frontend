import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = () =>
  JSON.parse(readFileSync(".test-data/fixture.json", "utf8"));
async function login(page: Page, alias: string, pin = fixture()[alias].pin) {
  await page.getByLabel("Código da turma").fill(fixture().classroom.joinCode);
  await page.getByLabel("Seu apelido").fill(alias);
  await page.getByLabel("Seu PIN de 6 números").fill(pin);
  await page
    .getByRole("button", { name: "Entrar e continuar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: alias === "bia" ? "Olá, Bia!" : "Olá, Lucas!",
    }),
  ).toBeVisible();
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
}
async function mission(page: Page) {
  await page
    .getByRole("article")
    .filter({ hasText: fixture().mission.content.title })
    .getByRole("button")
    .click();
  await expect(page.getByLabel("Produção da equipe")).toBeVisible();
}
test("troca de conta com PIN local antigo preserva as duas cópias e permite novo acesso offline", async ({
  page,
  context,
}) => {
  const f = fixture();
  const oldPin = f.bia.pin === "112233" ? "332211" : "112233";
  await page.goto("/");
  await login(page, "bia");
  await mission(page);
  await page
    .getByLabel("Produção da equipe")
    .fill("Rascunho privado protegido pelo PIN anterior.");
  await expect(
    page.getByText("Salvo neste aparelho", { exact: true }),
  ).toBeVisible();
  await logout(page);
  // Reproduce an installed legacy PWA whose saved vault still uses a previous PIN.
  const original = await page.evaluate(
    async ({ classCode, currentPin, oldPin }) => {
      const bytes = new TextEncoder();
      const digest = await crypto.subtle.digest(
        "SHA-256",
        bytes.encode("student:" + classCode + ":bia"),
      );
      const id = [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("educaxp-private-v1", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const saved = await new Promise<any>((resolve, reject) => {
        const request = db.transaction("vaults").objectStore("vaults").get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      async function key(pin: string) {
        const material = await crypto.subtle.importKey(
          "raw",
          bytes.encode(pin),
          "PBKDF2",
          false,
          ["deriveKey"],
        );
        return crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            hash: "SHA-256",
            salt: saved.salt,
            iterations: 210000,
          },
          material,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        );
      }
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: saved.iv },
        await key(currentPin),
        saved.ciphertext,
      );
      saved.iv = crypto.getRandomValues(new Uint8Array(12));
      saved.ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: saved.iv },
        await key(oldPin),
        plaintext,
      );
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("vaults", "readwrite");
        tx.objectStore("vaults").put(saved, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return { id, ciphertext: Array.from(new Uint8Array(saved.ciphertext)) };
    },
    { classCode: f.classroom.joinCode, currentPin: f.bia.pin, oldPin },
  );
  await login(page, "lucas");
  await logout(page);
  await login(page, "bia");
  await mission(page);
  await expect(page.getByLabel("Produção da equipe")).not.toHaveValue(
    "Rascunho privado protegido pelo PIN anterior.",
  );
  await page
    .getByLabel("Produção da equipe")
    .fill("Nova investigação com o PIN atual.");
  await expect(
    page.getByText("Salvo neste aparelho", { exact: true }),
  ).toBeVisible();
  const preserved = await page.evaluate(async (id) => {
    return new Promise<number[]>((resolve, reject) => {
      const opening = indexedDB.open("educaxp-private-v1", 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const request = db.transaction("vaults").objectStore("vaults").get(id);
        request.onsuccess = () => {
          db.close();
          resolve(Array.from(new Uint8Array(request.result.ciphertext)));
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      };
    });
  }, original.id);
  expect(preserved).toEqual(original.ciphertext);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await logout(page);
  await context.setOffline(true);
  await page.reload();
  await login(page, "bia");
  await mission(page);
  await expect(page.getByLabel("Produção da equipe")).toHaveValue(
    "Nova investigação com o PIN atual.",
  );
  const other = await context.newPage();
  await other.goto("/");
  await other.getByLabel("Código da turma").fill(f.classroom.joinCode);
  await other.getByLabel("Seu apelido").fill("bia");
  await other.getByLabel("Seu PIN de 6 números").fill(oldPin);
  await other
    .getByRole("button", { name: "Entrar e continuar", exact: true })
    .click();
  await expect(other.getByRole("alert")).toContainText("outra aba");
  await other.close();
  await logout(page);
  await login(page, "bia", oldPin);
  await mission(page);
  await expect(page.getByLabel("Produção da equipe")).toHaveValue(
    "Rascunho privado protegido pelo PIN anterior.",
  );
});
