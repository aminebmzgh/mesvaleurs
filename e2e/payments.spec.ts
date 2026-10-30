import { expect, type Page, test } from "@playwright/test";
import { confirmFundsIfNeeded, login, uniqueSuffix } from "./helpers";

/**
 * Saisit une facture depuis l'assistant (fournisseur déjà choisi) et ne laisse cochée
 * qu'elle : les tests restent indépendants des factures ouvertes laissées par d'autres.
 */
async function quickInvoice(page: Page, number: string, amount: string) {
  await page.getByRole("button", { name: "Saisir une nouvelle facture" }).click();
  await page.getByLabel("Numéro de facture").fill(number);
  await page.getByLabel("Montant TTC (DH)").fill(amount);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(`Facture ${number} enregistrée.`)).toBeVisible();

  const checkboxes = page.getByRole("checkbox", { name: /^Régler la facture / });
  for (const checkbox of await checkboxes.all()) {
    const label = await checkbox.getAttribute("aria-label");
    if (label !== `Régler la facture ${number}` && (await checkbox.isChecked())) {
      await checkbox.uncheck();
    }
  }
}

test("régler une facture en deux chèques, puis annuler l'un d'eux", async ({ page }) => {
  const number = `CHQ-${uniqueSuffix()}`;
  await login(page, "preparateur@demo.ma");
  await page.goto("/paiements/nouveau");

  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Bureau Pro Fournitures" });
  await expect(page.getByText("Choisissez le fournisseur.")).toHaveCount(0);
  // Les factures ouvertes (dont BP-10293) sont cochées par défaut
  await expect(page.getByLabel("Régler la facture BP-10293")).toBeChecked();
  await quickInvoice(page, number, "10 000,01");

  await expect(page.getByLabel("Montant à régler (DH)")).toHaveValue(/^10\s000,01$/);
  await page.getByLabel("Nombre de chèques").fill("2");
  // Parts égales : l'écart d'arrondi va sur la dernière
  await expect(page.getByRole("cell", { name: /^5\s000,00$/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /^5\s000,01$/ })).toBeVisible();
  await expect(page.getByText("Cinq mille dirhams et un centime").first()).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await confirmFundsIfNeeded(page);
  await page.getByRole("button", { name: "Émettre 2 chèques" }).click();

  await expect(page.getByText("Numéros attribués")).toBeVisible();
  await expect(page.getByRole("link", { name: `${number} (5 000,00 DH)` })).toBeVisible();
  await expect(page.getByRole("link", { name: `${number} (5 000,01 DH)` })).toBeVisible();

  // La facture est réglée, pas encore encaissée
  await page.getByRole("link", { name: `${number} (5 000,00 DH)` }).click();
  await expect(page.getByText("Payée", { exact: true })).toBeVisible();

  // Annulation du premier chèque depuis la liste : la facture redevient partiellement payée
  const firstNumber = (await page.getByRole("row").nth(1).getByRole("cell").nth(1).textContent())!.trim();
  await page.goto(`/paiements?numero=${firstNumber}`);
  await page.getByRole("button", { name: "Annuler" }).click();
  await page.getByLabel("Motif").fill("Formule gâchée à l'impression");
  await page.getByRole("button", { name: "Confirmer l'annulation" }).click();
  await expect(page.getByText("Paiement annulé.")).toBeVisible();

  await page.goto(`/paiements?numero=${firstNumber}&statut=all`);
  await expect(page.getByText("Annulé", { exact: true })).toBeVisible();
  await expect(page.getByText("Formule gâchée à l'impression")).toBeVisible();
});

test("LCN échelonnées à 30/60/90 jours avec montants personnalisés", async ({ page }) => {
  const number = `LCN-${uniqueSuffix()}`;
  await login(page, "gestionnaire@demo.ma");
  await page.goto("/paiements/nouveau");

  await page.getByRole("radio", { name: "LCN" }).click();
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Maghreb Emballages SA" });
  await quickInvoice(page, number, "900 000,00");

  await page.getByLabel("Date d'émission").fill("2026-11-02");
  await page.getByLabel("Nombre de LCN").fill("3");
  await expect(page.getByLabel("Échéance de la LCN 1")).toHaveValue("2026-12-02");
  await expect(page.getByLabel("Échéance de la LCN 2")).toHaveValue("2027-01-01");
  await expect(page.getByLabel("Échéance de la LCN 3")).toHaveValue("2027-01-31");

  // Répartition personnalisée incomplète : refus explicite
  await page.getByRole("radio", { name: "Montants personnalisés" }).click();
  await page.getByLabel("Montant de la formule 1").fill("400 000");
  await page.getByLabel("Montant de la formule 2").fill("300 000");
  await page.getByLabel("Montant de la formule 3").fill("100 000");
  await expect(page.getByText(/diffère du total de 100\s000,00\sDH \(reste à répartir\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Émettre 3 LCN" })).toBeDisabled();

  await page.getByLabel("Montant de la formule 3").fill("200 000");
  // Montant supérieur à la provision du compte LCN (140 000 DH au départ) : émission à confirmer, quel que soit l'ordre des tests
  await expect(page.getByText(/^Provision insuffisante :/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Émettre 3 LCN" })).toBeDisabled();
  await page.getByLabel(/J'émets quand même/).check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Émettre 3 LCN" }).click();

  await expect(page.getByText("Numéros attribués")).toBeVisible();
  await expect(page.getByRole("cell", { name: "02/12/2026" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "31/01/2027" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /^400\s000,00\sDH$/ })).toBeVisible();
});

test("un dépassement du reste dû doit être confirmé", async ({ page }) => {
  const number = `DEP-${uniqueSuffix()}`;
  await login(page, "gestionnaire@demo.ma");
  await page.goto("/paiements/nouveau");
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Centrale Agro Distribution" });
  await quickInvoice(page, number, "1 000,00");

  await page.getByLabel("Montant à régler (DH)").fill("1 500,00");
  await expect(page.getByText("Le montant dépasse le reste dû de 500,00 DH.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Émettre 1 chèque" })).toBeDisabled();
  await page.getByLabel(/Je confirme le dépassement/).check();
  await confirmFundsIfNeeded(page);
  await expect(page.getByRole("button", { name: "Émettre 1 chèque" })).toBeEnabled();
});
