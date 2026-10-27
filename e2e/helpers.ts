import { expect, type Page } from "@playwright/test";

/** Mot de passe des comptes du seed de démonstration. */
export const DEMO_PASSWORD = "Demo1234";

/** Connexion par le formulaire, comme un utilisateur. */
export async function login(page: Page, email: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/tableau-de-bord/);
}

/** Choisit une option dans une liste déroulante (Base UI Select). */
export async function selectOption(page: Page, label: string, option: string) {
  await page.getByLabel(label).click();
  await page.getByRole("option", { name: option }).click();
}

/** Suffixe unique, pour que les tests restent rejouables sans réinitialiser la base. */
export function uniqueSuffix() {
  return Date.now().toString(36);
}
