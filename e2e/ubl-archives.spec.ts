import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

const template = fs.readFileSync(path.join(__dirname, "fixtures", "facture-ubl.xml"), "utf8");
const ubl = (number: string, ice: string, name: string) =>
  Buffer.from(template.replaceAll("{{NUMBER}}", number).replaceAll("{{ICE}}", ice).replaceAll("{{NAME}}", name));

test("factures UBL importées après vérification, puis archivées et vérifiées", async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = uniqueSuffix();
  const newIce = `9${String(Date.now()).padStart(14, "0")}`;
  const newSupplier = `Emballages du Nord ${suffix}`;
  const unknown = `UBL-${suffix}-1`;
  const known = `UBL-${suffix}-2`;
  await login(page, "gestionnaire@demo.ma");

  await page.goto("/factures");
  await page.getByRole("link", { name: "Factures UBL" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Fichiers").setInputFiles([
    { name: "inconnu.xml", mimeType: "application/xml", buffer: ubl(unknown, newIce, newSupplier) },
    // ICE de Sotrama, fournisseur existant
    { name: "sotrama.xml", mimeType: "application/xml", buffer: ubl(known, "001234567000089", "SOTRAMA MATERIAUX") },
  ]);

  const unknownCard = page.getByRole("region", { name: "Fichier inconnu.xml" });
  const knownCard = page.getByRole("region", { name: "Fichier sotrama.xml" });
  await expect(knownCard.getByRole("link", { name: "Sotrama Matériaux SARL" })).toBeVisible();
  await expect(knownCard.getByText(/^14\s400,00\sDH$/)).toBeVisible();
  // Fournisseur inconnu : rien n'est créé sans confirmation
  await expect(page.getByRole("button", { name: "Importer 1 facture(s)" })).toBeEnabled();
  await unknownCard.getByLabel(new RegExp(`Fournisseur inconnu : créer « ${newSupplier} »`)).check();
  await page.getByRole("button", { name: "Importer 2 facture(s)" }).click();
  await expect(unknownCard.getByText("Importée et archivée")).toBeVisible();
  await expect(knownCard.getByText("Importée et archivée")).toBeVisible();

  // Même fichier à nouveau : doublon refusé
  await page.getByLabel("Fichiers").setInputFiles({ name: "sotrama.xml", mimeType: "application/xml", buffer: ubl(known, "001234567000089", "SOTRAMA MATERIAUX") });
  await expect(page.getByText(`Facture ${known} déjà enregistrée pour ce fournisseur.`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Importer 0 facture(s)" })).toBeDisabled();

  // Facture créée avec son fournisseur, pièce archivée
  await page.goto("/factures");
  await page.getByRole("searchbox").fill(unknown);
  await page.getByRole("searchbox").press("Enter");
  await page.getByRole("link", { name: unknown }).click();
  await expect(page.getByRole("heading", { name: `Facture ${unknown}` })).toBeVisible();
  await expect(page.getByLabel("Montant TTC (DH)")).toHaveValue(/^14\s400,00$/);
  await page.getByRole("link", { name: "Voir les archives" }).click();

  const row = page.getByRole("row", { name: `Archive ${unknown}` });
  await expect(row.getByText(newSupplier)).toBeVisible();
  await expect(row.getByText(`ICE ${newIce}`)).toBeVisible();
  await expect(row.getByRole("link", { name: "Facture UBL" })).toBeVisible();
  await page.getByRole("button", { name: "Vérifier l'intégrité des pièces affichées" }).click();
  await expect(row.getByText("Intègre")).toBeVisible();
});
