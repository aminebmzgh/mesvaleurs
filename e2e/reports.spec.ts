import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("rapport de fin de mois : débités, en circulation, anomalies, exports", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/rapports?mois=2026-10");
  await expect(page.getByRole("heading", { name: "octobre 2026" })).toBeVisible();

  // Chèques 1000 et 1001 de Sotrama débités les 03/10 et 06/10 (relevé de démonstration)
  await expect(page.getByRole("heading", { name: "Sotrama Matériaux SARL" })).toBeVisible();
  await expect(page.getByText(/débité le 03\/10\/2026/)).toBeVisible();
  await expect(page.getByText(/F-2026-0412 \(24\s000,00\sDH\)/).first()).toBeVisible();

  // Anomalies : chèque 1002 débité 15 060 au lieu de 15 600 ; chèque 1017 inconnu
  const anomalies = page.getByRole("region", { name: "Écarts de montant" });
  await expect(anomalies.getByText(/CHEQUE 1002 : débité 15\s060,00\sDH, Chèque 0001002 émis 15\s600,00\sDH/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Débits inconnus" }).getByText(/CHQ 0001017 \(n° 1017\)/)).toBeVisible();

  // Exports Excel et PDF
  const xlsx = await page.request.get("/rapports/export?mois=2026-10&format=xlsx");
  expect(xlsx.headers()["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");
  const pdf = await page.request.get("/rapports/export?mois=2026-10&format=pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Navigation de mois en mois
  await page.getByRole("link", { name: "Mois précédent" }).click();
  await expect(page.getByRole("heading", { name: "septembre 2026" })).toBeVisible();
  await expect(page.getByText("Aucun débit rapproché ce mois-ci.")).toBeVisible();
});

test("tableau de bord : indicateurs et sections", async ({ page }) => {
  await login(page, "admin@demo.ma");
  for (const label of ["Solde bancaire", "En circulation", "Solde prévisionnel", "Reste à payer"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("LCN à échoir sous 30 jours")).toBeVisible();
  await expect(page.getByText("Factures en retard")).toBeVisible();
  await expect(page.getByText("Dernières opérations bancaires")).toBeVisible();
  await expect(page.getByText("VIREMENT RECU CLIENT MARJANE")).toBeVisible();
});
