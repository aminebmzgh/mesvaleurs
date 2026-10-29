import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("export comptable mensuel : code auxiliaire du fournisseur, comptes et format", async ({ page }) => {
  await login(page, "admin@demo.ma");

  // Code comptable de Sotrama (compte auxiliaire)
  await page.goto("/fournisseurs");
  await page.getByRole("link", { name: "Sotrama Matériaux SARL" }).click();
  await page.getByLabel("Code comptable (compte auxiliaire)").fill("FSOTRAMA");
  await page.getByRole("button", { name: "Enregistrer" }).last().click();
  await expect(page.getByText("Fournisseur enregistré.")).toBeVisible();

  // Paramètres : comptes par défaut affichés
  await page.getByRole("link", { name: "Comptabilité" }).click();
  await expect(page.getByLabel("Compte fournisseurs")).toHaveValue("44110000");
  await expect(page.getByLabel("Compte de banque par défaut")).toHaveValue("51410000");

  // Octobre 2026 : chèques 1000 et 1001 du seed (Sotrama), débités les 3 et 6 octobre
  await page.goto("/rapports?mois=2026-10");
  const href = await page.getByRole("link", { name: "Export comptable (CSV)" }).getAttribute("href");
  const csv = await (await page.request.get(href!)).text();
  const rows = csv.split("\r\n");
  expect(rows[0]).toContain("Date;Journal;Compte;Compte auxiliaire;Pièce;Libellé;Débit;Crédit");
  expect(rows).toContain("03/10/2026;BQ;44110000;FSOTRAMA;0001000;Règlement Sotrama Matériaux SARL — Chèque 0001000 — F-2026-0412;24000,00;");
  expect(rows).toContain("03/10/2026;BQ;51410000;;0001000;Règlement Sotrama Matériaux SARL — Chèque 0001000 — F-2026-0412;;24000,00");

  // Format paramétré : point décimal
  await page.goto("/parametres/comptabilite");
  await page.getByLabel("Séparateur décimal").selectOption(".");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres de l'export comptable enregistrés.")).toBeVisible();
  expect(await (await page.request.get(href!)).text()).toContain(";24000.00;");

  // Retour au format par défaut, pour les autres tests
  await page.getByLabel("Séparateur décimal").selectOption(",");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres de l'export comptable enregistrés.")).toBeVisible();
});

test("le comptable consulte les paramètres comptables sans pouvoir les modifier", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/parametres/comptabilite");
  await expect(page.getByLabel("Code journal")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
});
