import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("une page protégée renvoie vers la connexion", async ({ page }) => {
  await page.goto("/fournisseurs");
  await expect(page).toHaveURL(/\/connexion\?suivant=%2Ffournisseurs/);
});

test("un mauvais mot de passe affiche une erreur en français", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill("admin@demo.ma");
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe1");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Adresse e-mail ou mot de passe incorrect.")).toBeVisible();
});

test("chaque entreprise ne voit que ses données", async ({ page }) => {
  await login(page, "souss@demo.ma");
  await expect(page.getByRole("button", { name: "Changer d'entreprise" })).toContainText("Souss Négoce SARL");
  await page.goto("/comptes-bancaires");
  await expect(page.getByText("Compte courant")).toBeVisible();
  await expect(page.getByText("Compte principal")).toHaveCount(0);
});

test("déconnexion", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.getByRole("button", { name: "Menu utilisateur" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
});
