import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { confirmFundsIfNeeded, login, uniqueSuffix } from "./helpers";

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
  await confirmFundsIfNeeded(page);
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

/** Relevé PDF « texte » : lignes de [x, texte], une ligne tous les 14 points. */
async function statementPdf(lines: [number, string][][], pageCount = 1): Promise<Buffer> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([595, 842]);
    lines.forEach((parts, row) => {
      for (const [x, text] of parts) {
        page.drawText(text, { x, y: 800 - row * 14, size: 9, font });
      }
    });
  }
  return Buffer.from(await document.save());
}

test("un relevé PDF texte est lu et rapproché", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");
  const number = await issueCheck(page, `PDF-${uniqueSuffix()}`, "4 444,44");
  const pdf = await statementPdf([
    [[40, "ATTIJARIWAFA BANK - Relevé de compte"]],
    [],
    [[40, "Date"], [110, "Valeur"], [180, "Libellé"], [420, "Débit"], [500, "Crédit"]],
    [[40, "Solde précédent"], [490, "100 000,00"]],
    [[40, "29/10/2026"], [110, "29/10/2026"], [180, `CHQ ${number}`], [410, "4 444,44"]],
    [[180, "SOTRAMA MATERIAUX"]],
    [[40, "29/10/2026"], [110, "29/10/2026"], [180, `FRAIS TENUE ${uniqueSuffix()}`], [420, "35,00"]],
  ]);

  await page.goto("/rapprochement/importer");
  await page.getByLabel("Compte bancaire").selectOption({ label: "Compte principal · Attijariwafa bank" });
  await page.getByLabel("Fichier").setInputFiles({ name: `releve-${uniqueSuffix()}.pdf`, mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByText(/Relevé PDF lu \(Lecture générique\)/)).toBeVisible();
  await expect(page.getByText(/2 mouvement\(s\) du 29\/10\/2026 au 29\/10\/2026/)).toBeVisible();
  await expect(page.getByRole("cell", { name: `CHQ ${number} SOTRAMA MATERIAUX`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Importer et rapprocher 2 mouvement/ }).click();
  await expect(page.getByText(/1 rapprochée\(s\), 0 à confirmer/)).toBeVisible();
  await page.getByRole("tab", { name: /Rapprochées/ }).click();
  await expect(page.getByLabel(`Ligne CHQ ${number} SOTRAMA MATERIAUX`).getByText("Rapprochée")).toBeVisible();
});

/**
 * Relevé papier « scanné » : dessiné dans le navigateur (polices identiques en local et en CI),
 * lignes de [x en points, texte] sur une image A4 à 200 ppp.
 */
async function scannedStatement(page: Page, lines: [number, string][][]): Promise<Buffer> {
  const dataUrl = await page.evaluate((rows) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1654;
    canvas.height = 2339;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111111";
    context.font = "28px Arial, Helvetica, sans-serif";
    rows.forEach((parts, row) => parts.forEach(([x, text]) => context.fillText(text, x * (1654 / 595), 160 + row * 52)));
    return canvas.toDataURL("image/png");
  }, lines);
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

/** PDF scanné : l'image seule, sans couche texte. */
async function imagePdf(images: Buffer[]): Promise<Buffer> {
  const { PDFDocument } = await import("pdf-lib");
  const document = await PDFDocument.create();
  for (const image of images) {
    const png = await document.embedPng(image);
    document.addPage([595, 842]).drawImage(png, { x: 0, y: 0, width: 595, height: 842 });
  }
  return Buffer.from(await document.save());
}

const SCAN_HEADER: [number, string][] = [[40, "Date"], [130, "Libellé"], [400, "Débit"], [490, "Crédit"]];

test("un relevé PDF scanné est lu par OCR, vérifié puis rapproché", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "gestionnaire@demo.ma");
  const number = await issueCheck(page, `OCR-${uniqueSuffix()}`, "6 123,45");

  await page.goto("/rapprochement/importer");
  await page.waitForLoadState("networkidle");
  const scan = await scannedStatement(page, [
    [[40, "ATTIJARIWAFA BANK - Relevé de compte"]],
    [],
    SCAN_HEADER,
    [[40, "29/10/2026"], [130, `CHQ ${number}`], [400, "6 123,45"]],
    [[40, "29/10/2026"], [130, "FRAIS TENUE DE COMPTE"], [400, "35,00"]],
  ]);
  await page.getByLabel("Compte bancaire").selectOption({ label: "Compte principal · Attijariwafa bank" });
  await page.getByLabel("Fichier").setInputFiles({ name: `scan-${uniqueSuffix()}.pdf`, mimeType: "application/pdf", buffer: await imagePdf([scan]) });

  await expect(page.getByText(/Relevé scanné lu par OCR \(1 page\)/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("img", { name: "Page 1 du relevé scanné" })).toBeVisible();
  await expect(page.getByLabel("Date, ligne 1")).toHaveValue("2026-10-29");
  await expect(page.getByLabel("Libellé, ligne 1")).toHaveValue(new RegExp(`CHQ ${number}`));
  await expect(page.getByLabel("Débit, ligne 1")).toHaveValue(/^6\s123,45$/);

  // Vérification obligatoire avant l'import
  const submit = page.getByRole("button", { name: /Importer et rapprocher 2 mouvement/ });
  await expect(submit).toBeDisabled();
  await page.getByLabel(/J'ai vérifié chaque ligne/).check();
  await submit.click();
  await expect(page.getByText(/1 rapprochée\(s\)/)).toBeVisible();
});

test("photo d'un relevé : lignes corrigées, ajoutées et supprimées avant l'import", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "gestionnaire@demo.ma");
  await page.goto("/rapprochement/importer");
  await page.waitForLoadState("networkidle");
  const photo = await scannedStatement(page, [
    SCAN_HEADER,
    [[40, "27/10/2026"], [130, "VIREMENT RECU CLIENT ATLAS"], [490, "12 500,00"]],
    [[40, "28/10/2026"], [130, "COMMISSION SUR VIREMENT"], [400, "15,00"]],
  ]);
  await page.getByLabel("Fichier").setInputFiles({ name: "photo-releve.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByLabel("Crédit, ligne 1")).toHaveValue(/^12\s500,00$/, { timeout: 90_000 });

  await page.getByRole("button", { name: "Supprimer la ligne 2" }).click();
  await page.getByRole("button", { name: "Ajouter une ligne oubliée" }).click();
  await page.getByLabel(/J'ai vérifié chaque ligne/).check();
  // Ligne ajoutée incomplète : import bloqué
  await expect(page.getByText("1 ligne(s) à compléter avant l'import.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Importer et rapprocher 1 mouvement/ })).toBeDisabled();

  await page.getByLabel("Libellé, ligne 2").fill("FRAIS DE TENUE");
  await page.getByLabel("Débit, ligne 2").fill("20,00");
  await expect(page.getByRole("button", { name: /Importer et rapprocher 2 mouvement/ })).toBeEnabled();
  await expect(page.getByText(/débits 20,00\sDH · crédits 12\s500,00\sDH/)).toBeVisible();
});

test("un scan illisible est refusé avec une explication", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");
  await page.goto("/rapprochement/importer");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Fichier").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: await statementPdf([], 1) });
  await expect(page.getByText(/Aucun texte lisible sur ce scan/)).toBeVisible({ timeout: 60_000 });
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
