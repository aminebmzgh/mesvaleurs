import { expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

// PNG 1 × 1 pixel, en guise de scan de formule
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("modèle d'impression : copie, réglage, scan, impression test, association au carnet", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");
  await page.goto("/comptes-bancaires/modeles");
  await page.getByRole("button", { name: /Chèque Attijariwafa bank/ }).click();

  await expect(page.getByRole("heading", { name: "Chèque Attijariwafa bank" }).first()).toBeVisible();
  await expect(page.getByRole("application", { name: "Éditeur de la formule" })).toBeVisible();

  const name = `Chèque AWB ${uniqueSuffix()}`;
  await page.getByLabel("Nom du modèle").fill(name);
  await page.getByLabel("Décalage X (mm)").fill("1.5");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Modèle enregistré.")).toBeVisible();

  await page.getByLabel("Choisir le scan de la formule").setInputFiles({ name: "cheque.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Scan de la formule enregistré.")).toBeVisible();

  // Impression test : PDF généré avec le scan en fond
  const testUrl = await page.getByRole("link", { name: "Impression test" }).getAttribute("href");
  const pdf = await page.request.get(testUrl!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Association au chéquier du compte principal
  await page.goto("/comptes-bancaires/c0000000-0000-4000-8000-000000000001");
  const select = page.getByLabel("Modèle d'impression du carnet").first();
  await select.selectOption({ label: name });
  await expect(page.getByText("Modèle d'impression associé.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Modèle d'impression du carnet").first()).toHaveValue(/[0-9a-f-]{36}/);
});

test("imprimer puis réimprimer un lot", async ({ page }) => {
  const number = `IMP-${uniqueSuffix()}`;
  await login(page, "preparateur@demo.ma");
  await page.goto("/paiements/nouveau");
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Atlas Transport & Logistique" });
  await page.getByRole("button", { name: "Saisir une nouvelle facture" }).click();
  await page.getByLabel("Numéro de facture").fill(number);
  await page.getByLabel("Montant TTC (DH)").fill("4 250,00");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(`Facture ${number} enregistrée.`)).toBeVisible();
  for (const checkbox of await page.getByRole("checkbox", { name: /^Régler la facture / }).all()) {
    if ((await checkbox.getAttribute("aria-label")) !== `Régler la facture ${number}`) {
      await checkbox.uncheck();
    }
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Émettre 1 chèque" }).click();
  await expect(page.getByText("Numéros attribués")).toBeVisible();

  const printLink = page.getByRole("link", { name: "Imprimer", exact: true });
  const pdf = await page.request.get((await printLink.getAttribute("href"))!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // Après impression : le bouton devient « Réimprimer », la date est affichée
  await page.reload();
  await expect(page.getByRole("link", { name: "Réimprimer" })).toBeVisible();
  await expect(page.getByText(/^Imprimé le \d{2}\/\d{2}\/\d{4}/)).toBeVisible();

  await page.request.get((await page.getByRole("link", { name: "Réimprimer" }).getAttribute("href"))!);
  await page.reload();
  await expect(page.getByText(/1 réimpression\(s\)/)).toBeVisible();
});

test("le comptable n'accède pas à l'impression", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  // Redirection rendue en flux (derrière Suspense) : vérifiée dans le navigateur
  await page.goto("/comptes-bancaires/modeles");
  await expect(page).toHaveURL(/erreur=acces-refuse/);
  await expect(page.getByText("Votre rôle ne vous permet pas d'accéder à cette page.")).toBeVisible();
});
