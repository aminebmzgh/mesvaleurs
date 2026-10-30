import { expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

test("relevé du fournisseur : écarts, facture manquante créée, rapport exporté", async ({ page }) => {
  const suffix = uniqueSuffix();
  const name = `Fournisseur relevé ${suffix}`;
  await login(page, "gestionnaire@demo.ma");

  // Fournisseur et facture dans nos livres
  await page.goto("/fournisseurs/nouveau");
  await page.getByLabel("Raison sociale").fill(name);
  await page.getByLabel("Ville").fill("Tanger");
  await page.getByRole("button", { name: "Créer le fournisseur" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const supplierUrl = page.url();
  const supplierId = supplierUrl.split("/").pop()!;

  await page.goto(`/factures/nouvelle?fournisseur=${supplierId}`);
  await page.getByLabel("Numéro de facture").fill(`FA-${suffix}-1`);
  await page.getByLabel("Date de facture").fill("2026-10-05");
  await page.getByLabel("Montant TTC (DH)").fill("1 200,00");
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();
  await expect(page.getByRole("heading", { name: `Facture FA-${suffix}-1` })).toBeVisible();

  // Relevé du fournisseur : notre facture avec un autre format de numéro, et une facture inconnue
  const csv = [
    "Date;Pièce;Libellé;Débit;Crédit",
    "01/10/2026;;Solde reporté;3 000,00;",
    `05/10/2026;FA ${suffix} 01;Facture;1 200,00;`,
    `20/10/2026;FA-${suffix}-2;Facture;2 500,00;`,
  ].join("\r\n");
  await page.goto(supplierUrl);
  await page.getByRole("link", { name: "Rapprocher son relevé" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Fichier").setInputFiles({ name: "releve-fournisseur.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await expect(page.getByLabel("Pièce (n° de facture)")).toHaveValue("1");
  await expect(page.getByText(/1 ligne\(s\) concordante\(s\), 1 écart\(s\) · 1 ligne\(s\) de solde/)).toBeVisible();
  const gap = page.getByRole("row", { name: `Facture FA-${suffix}-2` });
  await expect(gap.getByText("Absent de nos livres")).toBeVisible();
  await expect(page.getByRole("region", { name: "Soldes de la période" }).getByText(/^2\s500,00\sDH$/)).toBeVisible();

  // Rapport exporté
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  const content = Buffer.concat(await (await (await download).createReadStream()).toArray()).toString("utf8");
  expect(content).toContain("Absent de nos livres");
  expect(content).toContain(`FA-${suffix}-2`);

  // Facture manquante : saisie pré-remplie
  await gap.getByRole("link", { name: "Créer la facture" }).click();
  await expect(page.getByLabel("Numéro de facture")).toHaveValue(`FA-${suffix}-2`);
  await expect(page.getByLabel("Date de facture")).toHaveValue("2026-10-20");
  await expect(page.getByLabel("Montant TTC (DH)")).toHaveValue(/^2\s500,00$/);
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();
  await expect(page.getByRole("heading", { name: `Facture FA-${suffix}-2` })).toBeVisible();
});
