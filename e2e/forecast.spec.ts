import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("prévision de trésorerie : courbe, débits prévus, factures en option", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.getByRole("link", { name: "Prévision de trésorerie" }).click();
  await expect(page.getByRole("heading", { name: "Prévision de trésorerie" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Solde prévisionnel sur 90 jours/ })).toBeVisible();
  // LCN 5000101 du seed (Maghreb Emballages) : débit prévu à son échéance
  await expect(page.getByRole("row").filter({ hasText: "LCN 5000101" }).getByText("LCN à échoir")).toBeVisible();

  await page.getByLabel(/Inclure les factures à payer/).check();
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page).toHaveURL(/factures=1/);
  await expect(page.getByText("Facture à payer").first()).toBeVisible();
});

test("calendrier des échéances : mois et semaine", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/calendrier?vue=mois&mois=2026-11");
  await expect(page.getByRole("heading", { name: "novembre 2026" })).toBeVisible();
  // LCN 5000101, échéance le 18/11/2026
  const chip = page.getByRole("link", { name: /LCN 5000101/ }).first();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute("title", /Échéance de LCN .* En (attente|retard)|Payé/);

  await page.getByRole("link", { name: "Semaine" }).click();
  await expect(page).toHaveURL(/vue=semaine/);
  await expect(page.getByRole("heading", { name: /^Semaine du / })).toBeVisible();
  await page.getByRole("link", { name: "Période suivante" }).click();
  await expect(page).toHaveURL(/semaine=\d{4}-\d{2}-\d{2}/);
});
