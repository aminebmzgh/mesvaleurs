import { expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

test("la fiche fournisseur présente soldes, factures et paiements", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/fournisseurs");

  // Recherche par ICE
  await page.getByRole("searchbox", { name: "Rechercher un fournisseur" }).fill("001357924000058");
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page).toHaveURL(/q=001357924000058/);
  await expect(page.getByRole("row")).toHaveCount(2);

  await page.getByRole("link", { name: "Centrale Agro Distribution" }).click();
  await expect(page.getByRole("heading", { name: "Centrale Agro Distribution" })).toBeVisible();
  // Reste 20 000 sur CAD-2026-332 ; CAD-2026-371 (18 900) contestée ; chèque annulé exclu
  await expect(page.getByText("20 000,00 DH").first()).toBeVisible();
  await expect(page.getByText("18 900,00 DH").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Contestée" })).toBeVisible();
  // Chèque 1004 du seed, gâché à l'impression
  await expect(page.getByRole("row").filter({ hasText: "0001004" }).getByRole("cell", { name: "Annulé" })).toBeVisible();
  await expect(page.getByText("Votre rôle permet uniquement la consultation.")).toBeVisible();
});

test("créer un fournisseur, refuser un ICE en double, conserver la saisie", async ({ page }) => {
  const name = `Fournisseur E2E ${uniqueSuffix()}`;
  await login(page, "preparateur@demo.ma");
  await page.goto("/fournisseurs/nouveau");

  await page.getByLabel("Raison sociale").fill(name);
  await page.getByLabel("Ville").fill("Fès");
  await page.getByLabel("ICE").fill("001234567000089"); // ICE de Sotrama, déjà enregistré
  await page.getByLabel("Délai de paiement convenu (jours)").fill("45");
  await page.getByRole("button", { name: "Créer le fournisseur" }).click();

  await expect(page.getByText("Un fournisseur avec cet ICE existe déjà dans votre entreprise.")).toBeVisible();
  await expect(page.getByLabel("Raison sociale")).toHaveValue(name);
  await expect(page.getByLabel("Ville")).toHaveValue("Fès");

  await page.getByLabel("ICE").fill("");
  await page.getByRole("button", { name: "Créer le fournisseur" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Délai convenu : 45 jours")).toBeVisible();
});
