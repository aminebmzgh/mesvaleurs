import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

const SEED_IMPORT = "/rapprochement/20000000-0000-4000-8000-000000000001";

/** Émet un chèque sur le compte principal et renvoie son numéro. */
async function issueCheck(page: Page, invoiceNumber: string, amount: string): Promise<string> {
  await page.goto("/paiements/nouveau");
  // Chéquier du compte principal (d'autres tests créent d'autres comptes et chéquiers)
  const checkbook = page.getByLabel("Chéquier");
  const options = await checkbook.locator("option").allTextContents();
  await checkbook.selectOption({ label: options.find((label) => label.startsWith("Compte principal"))! });
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Sotrama Matériaux SARL" });
  await page.getByRole("button", { name: "Saisir une nouvelle facture" }).click();
  await page.getByLabel("Numéro de facture").fill(invoiceNumber);
  await page.getByLabel("Montant TTC (DH)").fill(amount);
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(`Facture ${invoiceNumber} enregistrée.`)).toBeVisible();
  for (const checkbox of await page.getByRole("checkbox", { name: /^Régler la facture / }).all()) {
    if ((await checkbox.getAttribute("aria-label")) !== `Régler la facture ${invoiceNumber}`) {
      await checkbox.uncheck();
    }
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Émettre 1 chèque" }).click();
  await expect(page.getByText("Numéros attribués")).toBeVisible();
  return (await page.getByRole("row").nth(1).getByRole("cell").first().textContent())!.trim();
}

async function importCsv(page: Page, name: string, content: string | Buffer) {
  await page.goto("/rapprochement/importer");
  await page.getByLabel("Compte bancaire").selectOption({ label: "Compte principal · Attijariwafa bank" });
  await page.getByLabel("Fichier").setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.isBuffer(content) ? content : Buffer.from(content) });
}

test("réimporter le relevé de démonstration ne crée aucun doublon", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");
  await importCsv(page, "releve-awb-2026-10.csv", fs.readFileSync(path.join("supabase", "seed-files", "releve-awb-2026-10.csv")));
  await expect(page.getByText(/6 mouvement\(s\) du 03\/10\/2026 au 22\/10\/2026/)).toBeVisible();
  await page.getByRole("button", { name: /Importer et rapprocher 6 mouvement/ }).click();
  await expect(page.getByText("Toutes les lignes de ce relevé ont déjà été importées.")).toBeVisible();
});

test("importer un relevé : rapprochement automatique, lignes à traiter, ligne ignorée", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");
  const number = await issueCheck(page, `RAP-${uniqueSuffix()}`, "3 333,33");

  const csv = [
    "Date opération;Date valeur;Libellé;Débit;Crédit",
    `28/10/2026;28/10/2026;CHQ ${number} SOTRAMA;3 333,33;`,
    `28/10/2026;28/10/2026;COMMISSION ${uniqueSuffix()};12,50;`,
    "",
  ].join("\r\n");
  await importCsv(page, `releve-${uniqueSuffix()}.csv`, csv);

  // Colonnes reconnues, numéro détecté dans l'aperçu
  await expect(page.getByLabel("Débit", { exact: true })).toHaveValue("3");
  await expect(page.getByRole("cell", { name: String(Number(number)), exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Importer et rapprocher 2 mouvement/ }).click();
  await expect(page.getByText(/1 rapprochée\(s\), 0 à confirmer/)).toBeVisible();
  await expect(page).toHaveURL(/\/rapprochement\/[0-9a-f-]{36}$/);

  // Reste à traiter : la commission ; la ligne du chèque est rapprochée
  await expect(page.getByLabel(/^Ligne COMMISSION/)).toBeVisible();
  await page.getByRole("tab", { name: /Rapprochées/ }).click();
  await expect(page.getByLabel(`Ligne CHQ ${number} SOTRAMA`).getByText("Rapprochée")).toBeVisible();

  await page.getByRole("tab", { name: /À traiter/ }).click();
  await page.getByRole("button", { name: "Ignorer la ligne" }).click();
  await expect(page.getByText("Ligne ignorée.")).toBeVisible();
  await expect(page.getByText("Tout est rapproché : rien à traiter.")).toBeVisible();

  // Le chèque est passé en « débité »
  await page.goto(`/paiements?numero=${Number(number)}&statut=all`);
  await expect(page.getByText("Débité", { exact: true })).toBeVisible();
});

test("confirmer une proposition et associer une ligne manuellement", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");
  await page.goto(SEED_IMPORT);

  // Test rejouable : si une exécution précédente a confirmé la proposition, on la défait
  await page.getByRole("tab", { name: /Toutes/ }).click();
  const previous = page.getByLabel("Ligne CHEQUE 1002").getByRole("button", { name: "Défaire" });
  if (await previous.isVisible()) {
    await previous.click();
    await expect(page.getByText("Rapprochement défait.")).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: /Toutes/ }).click();
  }

  // Chèque 1002 : débité 15 060 au lieu de 15 600 → à confirmer, avec le chèque 1002 proposé
  const proposal = page.getByLabel("Ligne CHEQUE 1002");
  if (await proposal.getByText("Non rapprochée").isVisible()) {
    // Rapprochement défait : le chèque 1002 se rapproche à la main
    await proposal.getByRole("button", { name: "Associer" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Chèque 0001002/ }).click();
    await expect(page.getByText("Chèque 0001002 rapproché.")).toBeVisible();
    return;
  }
  await expect(proposal.getByText("À confirmer")).toBeVisible();
  await proposal.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Rapprochement confirmé.")).toBeVisible();

  // Chèque 1017 inconnu : associé manuellement au chèque 1003 (montants différents → confirmation)
  const unknown = page.getByLabel("Ligne CHQ 0001017");
  await unknown.getByRole("button", { name: "Associer" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Chèque 0001003/ }).click();
  await expect(page.getByText("Chèque 0001003 rapproché.")).toBeVisible();

  // Défaire le rapprochement manuel
  await page.getByRole("tab", { name: /Rapprochées/ }).click();
  await page.getByLabel("Ligne CHQ 0001017").getByRole("button", { name: "Défaire" }).click();
  await expect(page.getByText("Rapprochement défait.")).toBeVisible();
});

test("un export Excel est lu : dates Excel, montant signé, numéro de LCN", async ({ page }) => {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(
    [
      ["Relevé de compte — Banque Populaire"],
      [],
      ["Date", "Désignation", "Montant"],
      [new Date(Date.UTC(2026, 9, 27)), "ECH LCN 5000150 MAGHREB", -40000],
      [new Date(Date.UTC(2026, 9, 28)), "VERSEMENT ESPECES", 12500.5],
    ],
    { cellDates: true },
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Relevé");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  await login(page, "gestionnaire@demo.ma");
  await page.goto("/rapprochement/importer");
  await page.getByLabel("Compte bancaire").selectOption({ label: "Compte LCN · Banque Populaire" });
  await page.getByLabel("Fichier").setInputFiles({
    name: "releve.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(page.getByLabel("Montant signé (débit négatif)")).toHaveValue("2");
  await expect(page.getByText(/2 mouvement\(s\) du 27\/10\/2026 au 28\/10\/2026/)).toBeVisible();
  await expect(page.getByRole("cell", { name: "LCN 5000150", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: /^40\s000,00\sDH$/ })).toBeVisible();
});

test("le comptable consulte le rapprochement sans pouvoir le modifier", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/rapprochement");
  await expect(page.getByRole("link", { name: "Importer un relevé" })).toHaveCount(0);
  await page.goto(SEED_IMPORT);
  await page.getByRole("tab", { name: /Toutes/ }).click();
  await expect(page.getByLabel("Ligne CHQ 0001000 SOTRAMA")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmer" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Associer" })).toHaveCount(0);
});
