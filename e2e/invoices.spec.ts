import { expect, test } from "@playwright/test";
import { login, selectOption, uniqueSuffix } from "./helpers";

// PDF minimal valide, pour la pièce jointe
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

test("saisir, joindre, contester puis supprimer une facture", async ({ page }) => {
  const number = `E2E-${uniqueSuffix()}`;
  await login(page, "gestionnaire@demo.ma");
  await page.goto("/factures/nouvelle");

  await selectOption(page, "Fournisseur", "Bureau Pro Fournitures");
  await page.getByLabel("Numéro de facture").fill(number);
  await page.getByLabel("Date de facture").fill("2026-10-01");
  await page.getByLabel("Montant HT (DH)").fill("10 000,00");
  // TVA à 20 % et TTC calculés depuis le HT
  await expect(page.getByLabel("TVA (DH)")).toHaveValue(/^2\s000,00$/);
  await expect(page.getByLabel("Montant TTC (DH)")).toHaveValue(/^12\s000,00$/);
  // TTC corrigé à la main : il n'est plus recalculé, l'incohérence est signalée
  await page.getByLabel("Montant TTC (DH)").fill("12 500,00");
  await expect(page.getByLabel("Montant HT (DH)")).toHaveValue("10 000,00");
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();

  // Incohérence signalée, saisie conservée
  await expect(page.getByText("HT + TVA doit être égal au montant TTC.")).toBeVisible();
  await expect(page.getByLabel("Numéro de facture")).toHaveValue(number);

  await page.getByLabel("Montant TTC (DH)").fill("12 000,00");
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();

  // Bureau Pro : délai convenu de 30 jours → 01/10 + 30 j = 31/10
  await expect(page.getByRole("heading", { name: `Facture ${number}` })).toBeVisible();
  await expect(page.getByText("date limite légale : 31/10/2026")).toBeVisible();
  await expect(page.getByText("Non payée")).toBeVisible();

  // Pièce jointe envoyée directement vers Supabase Storage
  await page.getByLabel("Choisir la pièce jointe").setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("Pièce jointe enregistrée.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir la pièce jointe" })).toBeVisible();
  // Archivage légal : pièce conservée 10 ans
  await expect(page.getByText(/1 pièce\(s\) archivée\(s\), conservée\(s\) jusqu'au/)).toBeVisible();

  // Contestation et levée
  await page.getByRole("button", { name: "Contester" }).click();
  await expect(page.getByText("Contestée", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lever la contestation" }).click();
  await expect(page.getByText("Non payée")).toBeVisible();

  // Suppression refusée : pièce archivée
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Cette facture a des pièces archivées (conservées 10 ans) : elle ne peut pas être supprimée.")).toBeVisible();
  await expect(page.getByRole("heading", { name: `Facture ${number}` })).toBeVisible();
});

test("HT et TVA calculés depuis le TTC, TVA modifiable", async ({ page }) => {
  await login(page, "preparateur@demo.ma");
  await page.goto("/factures/nouvelle");
  await page.getByLabel("Montant TTC (DH)").fill("12 500,00");
  await expect(page.getByLabel("Montant HT (DH)")).toHaveValue(/^10\s416,67$/);
  await expect(page.getByLabel("TVA (DH)")).toHaveValue(/^2\s083,33$/);

  // TVA à 10 % : le HT suit, le TTC saisi ne change pas
  await page.getByLabel("TVA (DH)").fill("1 136,36");
  await expect(page.getByLabel("Montant HT (DH)")).toHaveValue(/^11\s363,64$/);
  await expect(page.getByLabel("Montant TTC (DH)")).toHaveValue("12 500,00");

  // TTC effacé : les montants calculés aussi
  await page.getByLabel("Montant TTC (DH)").fill("");
  await expect(page.getByLabel("Montant HT (DH)")).toHaveValue("");
  await expect(page.getByLabel("TVA (DH)")).toHaveValue("");
});

test("une facture en double est refusée", async ({ page }) => {
  await login(page, "preparateur@demo.ma");
  await page.goto("/factures/nouvelle");
  await selectOption(page, "Fournisseur", "Sotrama Matériaux SARL");
  await page.getByLabel("Numéro de facture").fill("F-2026-0412");
  await page.getByLabel("Date de facture").fill("2026-08-05");
  await page.getByLabel("Montant TTC (DH)").fill("48 000,00");
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();
  await expect(page.getByText("Ce fournisseur a déjà une facture avec ce numéro.")).toBeVisible();
});

test("liste filtrée et facture réglée par plusieurs LCN", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/factures?statut=all&q=ME%2F26");
  await expect(page.getByRole("row")).toHaveCount(3); // en-tête, facture, total
  await page.getByRole("link", { name: "ME/26/1187" }).click();

  // 3 LCN de 40 000 : réglée 120 000, encaissée 40 000 (une seule débitée)
  await expect(page.getByText("120 000,00 DH").first()).toBeVisible();
  await expect(page.getByText("40 000,00 DH").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "5000100" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Débité" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Contester" })).toHaveCount(0);
});
