import { type Browser, expect, type Page, test } from "@playwright/test";
import { confirmFundsIfNeeded, login, uniqueSuffix } from "./helpers";

const SUPPLIER = "Centrale Agro Distribution";

async function session(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await login(page, email);
  return page;
}

/** Le préparateur prépare un chèque pour une nouvelle facture du fournisseur ; renvoie l'URL du lot. */
async function prepareCheck(page: Page, invoice: string, amount: string): Promise<string> {
  await page.goto("/paiements/nouveau");
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: SUPPLIER });
  await page.getByRole("button", { name: "Saisir une nouvelle facture" }).click();
  await page.getByLabel("Numéro de facture").fill(invoice);
  await page.getByLabel("Montant TTC (DH)").fill(amount);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(`Facture ${invoice} enregistrée.`)).toBeVisible();
  for (const checkbox of await page.getByRole("checkbox", { name: /^Régler la facture / }).all()) {
    if ((await checkbox.getAttribute("aria-label")) !== `Régler la facture ${invoice}` && (await checkbox.isChecked())) {
      await checkbox.uncheck();
    }
  }
  page.once("dialog", (dialog) => dialog.accept());
  await confirmFundsIfNeeded(page);
  await page.getByRole("button", { name: "Émettre 1 chèque" }).click();
  await expect(page.getByText("Lot préparé : numéros réservés, à valider avant impression.")).toBeVisible();
  await expect(page).toHaveURL(/\/paiements\/lots\//);
  return new URL(page.url()).pathname;
}

test("double signature : plafond du fournisseur, validation puis refus par une autre personne", async ({ browser }) => {
  // Trois sessions et deux lots préparés
  test.setTimeout(90_000);
  const suffix = uniqueSuffix();
  const manager = await session(browser, "gestionnaire@demo.ma");
  const preparer = await session(browser, "preparateur@demo.ma");

  // Plafond journalier du fournisseur, fixé par le gestionnaire
  await manager.goto("/fournisseurs");
  await manager.getByRole("link", { name: SUPPLIER }).click();
  await manager.getByRole("button", { name: `Plafond journalier de ${SUPPLIER}` }).click();
  await manager.getByLabel("Plafond (DH)").fill("1 000,00");
  await manager.getByRole("button", { name: "Enregistrer" }).last().click();
  await expect(manager.getByText("Plafond enregistré.")).toBeVisible();

  // Préparation au-delà du plafond : lot à valider, pas d'impression
  const batchUrl = await prepareCheck(preparer, `DS-${suffix}-1`, "1 500,00");
  await expect(preparer.getByText("En attente de validation")).toBeVisible();
  await expect(preparer.getByText(/Plafond journalier du fournisseur dépassé/)).toBeVisible();
  await expect(preparer.getByRole("link", { name: /^Imprimer/ })).toHaveCount(0);
  await expect(preparer.getByRole("button", { name: "Valider" })).toHaveCount(0);
  expect((await preparer.request.get(`${batchUrl}/pdf?test=1`)).status()).toBe(409);

  // Validation par le gestionnaire, depuis la liste des lots à valider
  await manager.goto("/paiements/a-valider");
  const row = manager.getByRole("row").filter({ has: manager.locator(`a[href="${batchUrl}"]`) });
  await row.getByRole("button", { name: "Valider" }).click();
  await expect(manager.getByText("Lot validé : il peut être imprimé.")).toBeVisible();
  await preparer.goto(batchUrl);
  await expect(preparer.getByText(/Validé par Salma El Idrissi/)).toBeVisible();
  await expect(preparer.getByRole("link", { name: "Impression test" })).toBeVisible();

  // Second lot, refusé par l'administrateur
  const refusedUrl = await prepareCheck(preparer, `DS-${suffix}-2`, "1 200,00");
  const admin = await session(browser, "admin@demo.ma");
  await admin.goto(refusedUrl);
  await admin.getByRole("button", { name: "Refuser" }).click();
  await admin.getByLabel("Motif du refus").fill("Facture non conforme");
  await admin.getByRole("button", { name: "Confirmer le refus" }).click();
  await expect(admin.getByText("Lot refusé.")).toBeVisible();
  await expect(admin.getByText(/Refusé par Karim Benali .* : Facture non conforme/)).toBeVisible();

  // Journal d'audit : validation et refus tracés
  await admin.goto("/journal?action=refuse");
  await expect(admin.getByRole("row").filter({ hasText: "Refus de validation" }).first()).toBeVisible();
});
