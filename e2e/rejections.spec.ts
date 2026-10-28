import { expect, test } from "@playwright/test";
import { confirmFundsIfNeeded, login, uniqueSuffix } from "./helpers";

test("chèque rejeté : compte à rebours, alerte, puis régularisation par virement", async ({ page }) => {
  const suffix = uniqueSuffix();
  const invoiceNumber = `REJ-${suffix}`;
  const reference = `VIR-REJ-${suffix}`;
  await login(page, "gestionnaire@demo.ma");

  // Chèque émis pour une facture du test
  await page.goto("/paiements/nouveau");
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Bureau Pro Fournitures" });
  await page.getByRole("button", { name: "Saisir une nouvelle facture" }).click();
  await page.getByLabel("Numéro de facture").fill(invoiceNumber);
  await page.getByLabel("Montant TTC (DH)").fill("3 000,00");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(`Facture ${invoiceNumber} enregistrée.`)).toBeVisible();
  for (const box of await page.getByRole("checkbox", { name: /^Régler la facture / }).all()) {
    if ((await box.getAttribute("aria-label")) !== `Régler la facture ${invoiceNumber}` && (await box.isChecked())) {
      await box.uncheck();
    }
  }
  page.once("dialog", (dialog) => dialog.accept());
  await confirmFundsIfNeeded(page);
  await page.getByRole("button", { name: "Émettre 1 chèque" }).click();
  await expect(page.getByText("Numéros attribués")).toBeVisible();
  const chequeNumber = (await page.getByRole("row").nth(1).getByRole("cell").first().textContent())!.trim();
  expect(chequeNumber).toMatch(/^\d{7}$/);

  // Rejet pour provision insuffisante
  await page.goto(`/paiements?numero=${chequeNumber}&statut=all`);
  const row = page.getByRole("row").filter({ hasText: chequeNumber });
  await row.getByRole("button", { name: "Rejeté" }).click();
  await page.getByRole("button", { name: "Enregistrer le rejet" }).click();
  await expect(page.getByText("Rejet enregistré : régularisation à suivre.")).toBeVisible();
  await expect(row.getByText("Provision insuffisante")).toBeVisible();
  await expect(row.getByText(/^J-\d+ · avant le /)).toBeVisible();

  // Alerte immédiate sur le tableau de bord
  await page.goto("/tableau-de-bord");
  await expect(page.getByText(/paiements? rejetés? à régulariser/)).toBeVisible();
  await expect(page.getByText(`Chèque ${chequeNumber}`)).toBeVisible();

  // Régularisation par virement : même fournisseur et même facture, pré-remplis
  await page.goto(`/paiements?numero=${chequeNumber}&statut=all`);
  await row.getByRole("button", { name: "Régulariser" }).click();
  await page.getByLabel("Virement").check();
  await page.getByRole("link", { name: "Saisir le virement" }).click();
  await expect(page.getByText(/Régularisation du chèque .* rejeté/)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: `Régler la facture ${invoiceNumber}` })).toBeChecked();
  await expect(page.getByLabel("Montant (DH)")).toHaveValue(/^3\s000,00$/);
  await page.getByLabel("Référence du virement").fill(reference);
  await page.getByRole("button", { name: "Enregistrer le virement" }).click();
  await expect(page.getByText(/Virement enregistré : Chèque \d+ régularisé\./)).toBeVisible();

  // Le chèque rejeté est annulé et renvoie au virement ; la facture est réglée
  await page.goto(`/paiements?numero=${chequeNumber}&statut=all`);
  await expect(page.getByRole("row").filter({ hasText: chequeNumber }).getByText(`Rejeté, remplacé par virement ${reference}`)).toBeVisible();
  await page.goto("/tableau-de-bord");
  await expect(page.getByText(`Chèque ${chequeNumber}`)).toHaveCount(0);
});
