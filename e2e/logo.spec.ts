import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// PNG 1 × 1 valide
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("logo de l'entreprise : envoi, aperçu, retrait", async ({ page }) => {
  await login(page, "admin@demo.ma");
  await page.goto("/parametres/organisation");
  // Fichier choisi après l'hydratation, sinon le changement est perdu
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Choisir le logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Logo enregistré.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Logo de l'entreprise" })).toBeVisible();
  await page.getByRole("button", { name: "Retirer" }).click();
  await expect(page.getByText("Logo retiré.")).toBeVisible();
  await expect(page.getByLabel("Aucun logo")).toBeVisible();
});
