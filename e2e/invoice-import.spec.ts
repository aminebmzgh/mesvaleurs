import { expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

test("importer des factures : fournisseurs reconnus, créés, doublons ignorés", async ({ page }) => {
  const suffix = uniqueSuffix();
  const csv = [
    "Fournisseur;ICE;N° facture;Date facture;Montant HT;TVA;Montant TTC",
    // Reconnu par l'ICE (nom différent)
    `SOTRAMA;001234567000089;IMP-${suffix}-1;05/10/2026;1 000,00;200,00;1 200,00`,
    // Reconnu par la raison sociale
    `Bureau Pro Fournitures;;IMP-${suffix}-2;06/10/2026;;;450,00`,
    // Fournisseur inconnu : créé
    `Nouveau Fournisseur ${suffix} SARL;;IMP-${suffix}-3;07/10/2026;500,00;100,00;`,
    // Déjà saisie : ignorée
    "Sotrama Matériaux SARL;001234567000089;F-2026-0412;05/08/2026;;;48 000,00",
    // Incohérente : signalée
    `Bureau Pro Fournitures;;IMP-${suffix}-4;07/10/2026;100,00;20,00;125,00`,
  ].join("\r\n");

  await login(page, "preparateur@demo.ma");
  await page.goto("/factures");
  await page.getByRole("link", { name: "Importer" }).click();
  await expect(page.getByRole("heading", { name: "Importer des factures" })).toBeVisible();
  await page.getByLabel("Fichier Excel ou CSV").setInputFiles({ name: "factures.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  await expect(page.getByText(/4 facture\(s\) valide\(s\)/)).toBeVisible();
  await expect(page.getByText("Ligne 6 : HT + TVA différent du TTC.")).toBeVisible();
  await page.getByRole("button", { name: "Importer 4 facture(s)" }).click();

  await expect(page.getByText(/3 facture\(s\) importée\(s\) · 1 déjà présente\(s\) · 1 fournisseur\(s\) créé\(s\)/)).toBeVisible();

  // Facture reconnue par l'ICE, rattachée à Sotrama ; TTC calculé pour la facture du nouveau fournisseur
  await page.goto(`/factures?statut=all&q=IMP-${suffix}`);
  await expect(page.getByRole("row", { name: new RegExp(`Sotrama Matériaux SARL IMP-${suffix}-1`) })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(`Nouveau Fournisseur ${suffix} SARL IMP-${suffix}-3`) })).toContainText(/600,00/);
});
