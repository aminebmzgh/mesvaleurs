import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("reporter l'échéance d'une LCN avec l'accord du fournisseur", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");
  // LCN 5000102 du seed (Maghreb Emballages), échéance initiale le 18/12/2026
  await page.goto("/paiements?numero=5000102&statut=all");
  const row = page.getByRole("row").filter({ hasText: "5000102" });
  await row.getByRole("button", { name: "Reporter" }).click();
  await page.getByLabel("Motif").fill("Décalage de trésorerie accepté par le fournisseur");
  await page.getByRole("button", { name: "Reporter l'échéance" }).click();
  await expect(page.getByText(/^Échéance reportée au /)).toBeVisible();
  // L'échéance initiale reste visible, quel que soit le nombre de reports
  await expect(row.getByText(/Reportée.* · initiale le 18\/12\/2026/)).toBeVisible();

  // Journal d'audit : action tracée
  await page.goto("/journal?action=postpone");
  await expect(page.getByRole("row").filter({ hasText: "LCN n° 5000102" }).first()).toBeVisible();
});
