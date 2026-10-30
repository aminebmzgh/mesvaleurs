import { expect, test } from "@playwright/test";
import { login, selectOption } from "./helpers";

test("inventaire d'un chéquier : formules utilisées, annulées, restantes", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/comptes-bancaires");
  await page.getByRole("link", { name: /Compte principal/ }).first().click();
  // Chéquier 1000 → 1049 du seed
  await page.getByRole("link", { name: "0001000 → 0001049" }).click();
  await expect(page.getByRole("heading", { name: /Inventaire — Chéquier 0001000 → 0001049/ })).toBeVisible();

  // Formule 1004 gâchée à l'impression : annulée, avec son motif
  const cancelled = page.getByRole("row").filter({ hasText: "0001004" });
  await expect(cancelled.getByText("Annulée", { exact: true })).toBeVisible();
  await expect(cancelled.getByText("Erreur d'impression (décalage)")).toBeVisible();
  // Formule 1000 débitée : utilisée, liée au paiement
  await expect(page.getByRole("row").filter({ hasText: "0001000" }).first().getByRole("link", { name: "Chèque · Débité" })).toBeVisible();
  // Formules vierges regroupées en une plage restante, jusqu'à la dernière
  await expect(page.getByRole("row").filter({ hasText: /→ 0001049/ }).getByText(/^Restante \(\d+\)$/)).toBeVisible();
});

test("seuil d'alerte « carnet presque épuisé » réglable", async ({ page }) => {
  await login(page, "admin@demo.ma");
  await page.goto("/parametres/organisation");
  await selectOption(page, "Signaler un carnet presque épuisé à partir de", "10 formules restantes");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de l'entreprise enregistrées.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Signaler un carnet presque épuisé à partir de")).toHaveText(/10 formules restantes/);

  // Retour à la valeur par défaut, pour les autres tests
  await page.getByLabel("Signaler un carnet presque épuisé à partir de").click();
  await page.getByRole("option", { name: "5 formules restantes", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de l'entreprise enregistrées.")).toBeVisible();
});
