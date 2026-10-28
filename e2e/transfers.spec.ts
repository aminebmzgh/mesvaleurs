import { expect, test } from "@playwright/test";
import { login, selectOption, uniqueSuffix } from "./helpers";

test("virement en attente qui règle une facture, puis débité", async ({ page }) => {
  const suffix = uniqueSuffix();
  const invoiceNumber = `VIR-E2E-${suffix}`;
  const reference = `REF-${suffix}`;
  await login(page, "gestionnaire@demo.ma");

  // Facture à régler
  await page.goto("/factures/nouvelle");
  await selectOption(page, "Fournisseur", "Bureau Pro Fournitures");
  await page.getByLabel("Numéro de facture").fill(invoiceNumber);
  await page.getByLabel("Date de facture").fill("2026-10-05");
  await page.getByLabel("Montant TTC (DH)").fill("1 200,00");
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();
  await expect(page.getByRole("heading", { name: `Facture ${invoiceNumber}` })).toBeVisible();

  // Virement depuis la liste des paiements
  await page.goto("/paiements");
  await page.getByRole("link", { name: "Nouveau virement" }).click();
  await page.getByLabel("Compte débité").selectOption({ label: "Compte principal · Attijariwafa bank" });
  await page.getByLabel("Fournisseur").selectOption({ label: "Bureau Pro Fournitures" });
  // Seule la facture de ce test est réglée
  await expect(page.getByRole("checkbox", { name: `Régler la facture ${invoiceNumber}` })).toBeChecked();
  for (const box of await page.getByRole("checkbox", { name: /^Régler la facture / }).all()) {
    if ((await box.getAttribute("aria-label")) !== `Régler la facture ${invoiceNumber}`) {
      await box.uncheck();
    }
  }
  await expect(page.getByLabel("Montant (DH)")).toHaveValue(/^1\s200,00$/);
  await page.getByLabel("Référence du virement").fill(reference);
  await page.getByLabel("Déjà débité du compte à cette date").uncheck();
  await page.getByRole("button", { name: "Enregistrer le virement" }).click();

  // Liste des virements : en attente, référence affichée
  await expect(page).toHaveURL(/type=transfer/);
  const row = page.getByRole("row").filter({ hasText: reference });
  await expect(row.getByText("Émis")).toBeVisible();
  await expect(row.getByText("Virement")).toBeVisible();

  // Débit constaté
  await row.getByRole("button", { name: "Débité" }).click();
  await page.getByRole("button", { name: "Enregistrer le débit" }).click();
  await expect(page.getByText("Débit enregistré.")).toBeVisible();
  await expect(row.getByText("Débité", { exact: true })).toBeVisible();

  // La facture est réglée et encaissée par le virement
  await page.goto("/factures?statut=all&q=" + encodeURIComponent(invoiceNumber));
  await page.getByRole("link", { name: invoiceNumber }).click();
  await expect(page.getByText("Payée").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: reference })).toBeVisible();
});
