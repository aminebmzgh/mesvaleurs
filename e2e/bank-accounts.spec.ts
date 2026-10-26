import { expect, test } from "@playwright/test";
import { login, selectOption, uniqueSuffix } from "./helpers";

// RIB réels à clé valide ; le premier reçoit une faute sur la clé pour le test de refus
const VALID_RIB = "150500213301441691000532";
const WRONG_KEY_RIB = "150500213301441691000533";

test("créer un compte, puis ses chéquiers sans chevauchement de numéros", async ({ page }) => {
  const label = `Compte E2E ${uniqueSuffix()}`;
  await login(page, "admin@demo.ma");

  await page.goto("/comptes-bancaires");
  await page.getByRole("link", { name: "Nouveau compte" }).click();

  await selectOption(page, "Banque", "Crédit du Maroc");
  await page.getByLabel("Libellé").fill(label);
  await page.getByLabel("Solde d'ouverture (DH)").fill("25 000,50");

  // Clé RIB fausse : refus explicite
  await page.getByLabel("RIB").fill(WRONG_KEY_RIB);
  await page.getByRole("button", { name: "Créer le compte" }).click();
  await expect(page.getByText("Clé RIB invalide : vérifiez les chiffres saisis.")).toBeVisible();

  await page.getByLabel("RIB").fill(VALID_RIB);
  await page.getByRole("button", { name: "Créer le compte" }).click();

  // Fiche du compte : solde formaté à la marocaine
  await expect(page.getByRole("heading", { name: label })).toBeVisible();
  await expect(page.getByText("25 000,50 DH")).toBeVisible();

  // Premier chéquier
  await page.getByLabel("Premier numéro").fill("0000501");
  await page.getByLabel("Dernier numéro").fill("0000525");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Carnet enregistré.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "0000501 → 0000525" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "25 / 25" })).toBeVisible();

  // Chevauchement refusé
  await page.getByLabel("Premier numéro").fill("0000520");
  await page.getByLabel("Dernier numéro").fill("0000540");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText(/chevauchent un carnet du même type/)).toBeVisible();

  // Un carnet de LCN peut reprendre les mêmes numéros
  await selectOption(page, "Type", "Carnet de LCN");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Carnet enregistré.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Carnet de LCN" })).toBeVisible();
});

test("le comptable consulte les comptes en lecture seule", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/comptes-bancaires");
  await expect(page.getByRole("link", { name: "Nouveau compte" })).toHaveCount(0);

  await page.getByText("Compte principal").click();
  await expect(page.getByText("Seuls un administrateur ou un gestionnaire peuvent modifier ce compte.")).toBeVisible();
  await expect(page.getByText("Ajouter un carnet")).toHaveCount(0);
  await expect(page.getByLabel("Libellé")).toBeDisabled();
});
