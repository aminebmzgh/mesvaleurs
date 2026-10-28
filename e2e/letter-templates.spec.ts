import { expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

test("copier un modèle intégré, le personnaliser, puis le supprimer", async ({ page }) => {
  const name = `Modèle E2E ${uniqueSuffix()}`;
  await login(page, "gestionnaire@demo.ma");
  await page.getByRole("link", { name: "Modèles de lettres" }).click();
  await page.getByRole("link", { name: "Copier" }).first().click();

  await page.getByLabel("Nom du modèle").fill(name);
  await page.getByLabel("Corps de la lettre").fill("Bonjour {fournisseur}, voici {moyens} pour {total}.");
  // Aperçu avec des valeurs d'exemple
  await expect(page.getByLabel("Aperçu de la lettre").getByText("Bonjour Sotrama Matériaux SARL, voici 2 chèques pour 58 000,00 DH.")).toBeVisible();
  await page.getByRole("button", { name: "Créer le modèle" }).click();

  await expect(page).toHaveURL(/\/parametres\/lettres$/);
  await expect(page.getByText(name)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Supprimer le modèle ${name}` }).click();
  await expect(page.getByText("Modèle supprimé.")).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
});

test("le préparateur n'accède pas aux modèles de lettres", async ({ page }) => {
  await login(page, "preparateur@demo.ma");
  await expect(page.getByRole("link", { name: "Modèles de lettres" })).toHaveCount(0);
  await page.goto("/parametres/lettres");
  await expect(page).toHaveURL(/erreur=acces-refuse/);
});
