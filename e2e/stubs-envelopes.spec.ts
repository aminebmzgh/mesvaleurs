import { expect, type Page, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

async function expectPdf(page: Page, href: string | null) {
  expect(href).toBeTruthy();
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
}

test("modèle avec talon, barrement et mention « non endossable »", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");
  await page.goto("/comptes-bancaires/modeles");
  await page.getByRole("button", { name: /Chèque Attijariwafa bank/ }).click();
  await expect(page.getByRole("application", { name: "Éditeur de la formule" })).toBeVisible();
  await page.getByLabel("Nom du modèle").fill(`Chèque barré ${uniqueSuffix()}`);

  for (const field of ["Barrement (deux traits parallèles)", "Mention « non endossable »", "Talon : montant"]) {
    await page.getByLabel("Ajouter une zone").selectOption({ label: field });
  }
  // Aperçu : la mention est placée, le barrement est tracé
  await expect(page.getByRole("application", { name: "Éditeur de la formule" }).getByText("NON ENDOSSABLE")).toBeVisible();
  await expect(page.getByTitle("Barrement (deux traits parallèles)").locator("line")).toHaveCount(2);

  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modèle enregistré.")).toBeVisible();
  await expectPdf(page, await page.getByRole("link", { name: "Impression test" }).getAttribute("href"));
});

test("enveloppe adressée au fournisseur", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/fournisseurs");
  await page.getByRole("link", { name: "Maghreb Emballages SA" }).click();
  await page.getByLabel("Format d'enveloppe").selectOption("C6");
  const href = await page.getByRole("link", { name: "Enveloppe (PDF)" }).getAttribute("href");
  expect(href).toMatch(/\/enveloppe\?format=C6$/);
  await expectPdf(page, href);
});
