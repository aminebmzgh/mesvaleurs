import { expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

/** Date du jour (fuseau de l'entreprise) décalée de `days` jours, au format AAAA-MM-JJ. */
function localDate(days: number) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("plan de paiement : fournisseur stratégique, réserve, puis paiement préparé", async ({ page }) => {
  const suffix = uniqueSuffix();
  const name = `Fournisseur stratégique ${suffix}`;
  await login(page, "gestionnaire@demo.ma");

  // Fournisseur stratégique, facture dont la date limite (60 jours) tombe dans 5 jours
  await page.goto("/fournisseurs/nouveau");
  await page.getByLabel("Raison sociale").fill(name);
  await page.getByLabel("Ville").fill("Agadir");
  await page.getByLabel("Fournisseur stratégique").check();
  await page.getByRole("button", { name: "Créer le fournisseur" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const supplierId = page.url().split("/").pop()!;

  await page.goto(`/factures/nouvelle?fournisseur=${supplierId}`);
  await page.getByLabel("Numéro de facture").fill(`PLAN-${suffix}`);
  await page.getByLabel("Date de facture").fill(localDate(-55));
  await page.getByLabel("Montant TTC (DH)").fill("100,00");
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();
  await expect(page.getByRole("heading", { name: `Facture PLAN-${suffix}` })).toBeVisible();
  const invoiceId = page.url().split("/").pop()!;

  // Réserve hors d'atteinte : rien n'est payable, la facture est à reporter avec son amende
  await page.getByRole("link", { name: "Plan de paiement" }).click();
  await expect(page.getByRole("heading", { name: "Plan de paiement" })).toBeVisible();
  await page.getByLabel("Réserve de trésorerie à préserver (DH)").fill("999 999 999");
  await page.getByRole("button", { name: "Recalculer" }).click();
  const deferred = page.getByRole("row", { name: `À reporter : ${name}` });
  await expect(deferred).toBeVisible();
  await expect(deferred.getByText("Stratégique", { exact: true })).toBeVisible();
  await expect(deferred.getByRole("link", { name: `PLAN-${suffix}` })).toBeVisible();
  await expect(deferred.getByRole("cell", { name: /^[1-9][\d\s]*,\d{2}\sDH$/ }).last()).toBeVisible();
  await expect(deferred.getByRole("link", { name: /Préparer/ })).toHaveCount(0);

  // Paiement proposé en LCN : assistant pré-rempli
  const due = localDate(30);
  await page.goto(`/paiements/nouveau?fournisseur=${supplierId}&factures=${invoiceId}&mode=lcn&echeance=${due}`);
  await expect(page.getByRole("radio", { name: "LCN" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Fournisseur", { exact: true })).toHaveValue(supplierId);
  await expect(page.getByLabel(`Régler la facture PLAN-${suffix}`)).toBeChecked();
  await expect(page.getByLabel("Échéance de la LCN 1")).toHaveValue(due);
  await expect(page.getByLabel("Montant à régler (DH)")).toHaveValue(/^100,00$/);
});
