import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { formatDate, formatMAD } from "@/lib/format";
import { toWinAnsi } from "@/lib/printing/measure";
import type { MonthlyReport } from "./monthly";

const date = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

/** Classeur Excel : synthèse, débités, en circulation, anomalies (montants numériques, dates réelles). */
export function reportWorkbook(report: MonthlyReport): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = (rows: unknown[][], widths: number[], name: string) => {
    const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
    ws["!cols"] = widths.map((wch) => ({ wch }));
    // Format des montants et des dates, ligne d'en-tête exclue
    for (const address of Object.keys(ws)) {
      const cell = ws[address];
      if (address.startsWith("!") || !cell || typeof cell !== "object") {
        continue;
      }
      if (cell.t === "n") {
        cell.z = "#,##0.00";
      } else if (cell.t === "d") {
        cell.z = "dd/mm/yyyy";
      }
    }
    XLSX.utils.book_append_sheet(workbook, ws, name);
  };

  sheet(
    [
      [`Rapport de fin de mois — ${report.label}`],
      [report.organizationName + (report.accountLabel ? ` · ${report.accountLabel}` : "")],
      [],
      ["Chèques et LCN débités", report.paid.reduce((n, g) => n + g.payments.length, 0), report.paidTotal],
      ["En circulation", report.circulation.length, report.circulationTotal],
      ["Écarts de montant", report.anomalies.amountMismatches.length],
      ["Débits inconnus", report.anomalies.unknownDebits.length],
      ["Carnets avec numéros manquants", report.anomalies.missingNumbers.length],
      ["Paiements annulés", report.anomalies.cancelled.length],
    ],
    [34, 12, 16],
    "Synthèse",
  );
  sheet(
    [
      ["Fournisseur", "Formule", "Compte", "Émis le", "Débité le", "Montant", "Factures réglées"],
      ...report.paid.flatMap((group) =>
        group.payments.map((p) => [
          group.supplier,
          p.instrument,
          p.account,
          date(p.issueDate),
          date(p.debitedAt),
          p.amount,
          p.invoices.map((i) => `${i.number} (${formatMAD(i.amount)})`).join(", "),
        ]),
      ),
    ],
    [30, 18, 20, 12, 12, 14, 40],
    "Débités",
  );
  sheet(
    [
      ["Formule", "Fournisseur", "Compte", "Émis le", "Échéance", "Statut", "Ancienneté (jours)", "Tranche", "Montant"],
      ...report.circulation.map((p) => [
        p.instrument,
        p.supplier,
        p.account,
        date(p.issueDate),
        date(p.dueDate),
        p.delivered ? "Remis" : "Émis",
        p.ageDays,
        p.bucket,
        p.amount,
      ]),
    ],
    [18, 30, 20, 12, 12, 10, 18, 12, 14],
    "En circulation",
  );
  sheet(
    [
      ["Type", "Date", "Libellé ou formule", "Détail", "Montant relevé", "Montant émis"],
      ...report.anomalies.amountMismatches.map((a) => [
        a.confirmed ? "Écart de montant (confirmé)" : "Écart de montant (à confirmer)",
        date(a.date),
        a.label,
        a.instrument,
        a.lineAmount,
        a.paymentAmount,
      ]),
      ...report.anomalies.unknownDebits.map((u) => ["Débit inconnu", date(u.date), u.label, `n° ${u.number}`, u.amount, null]),
      ...report.anomalies.missingNumbers.map((m) => ["Numéros manquants", null, m.checkbook, m.numbers.join(", "), null, null]),
      ...report.anomalies.cancelled.map((c) => ["Annulé", null, c.instrument, `${c.supplier} — ${c.reason}`, null, c.amount]),
    ],
    [28, 12, 40, 40, 14, 14],
    "Anomalies",
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

type Column = { header: string; width: number; align?: "left" | "right" };

/** PDF A4 paysage, tableaux paginés. */
export async function reportPdf(report: MonthlyReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rapport de fin de mois — ${report.label}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [WIDTH, HEIGHT, MARGIN] = [842, 595, 36];
  let page: PDFPage = pdf.addPage([WIDTH, HEIGHT]);
  let y = HEIGHT - MARGIN;

  const write = (text: string, x: number, size: number, f: PDFFont = font, maxWidth?: number) => {
    let value = toWinAnsi(text);
    if (maxWidth) {
      while (value.length > 1 && f.widthOfTextAtSize(value, size) > maxWidth) {
        value = `${value.slice(0, -2)}…`;
      }
    }
    page.drawText(value, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    return f.widthOfTextAtSize(value, size);
  };
  const ensure = (space: number) => {
    if (y - space < MARGIN) {
      page = pdf.addPage([WIDTH, HEIGHT]);
      y = HEIGHT - MARGIN;
    }
  };
  const title = (text: string) => {
    ensure(40);
    y -= 18;
    write(text, MARGIN, 12, bold);
    y -= 6;
  };
  const table = (columns: Column[], rows: string[][]) => {
    const drawRow = (cells: string[], f: PDFFont) => {
      ensure(14);
      y -= 13;
      let x = MARGIN;
      cells.forEach((cell, i) => {
        const column = columns[i];
        const text = toWinAnsi(cell);
        const textWidth = Math.min(f.widthOfTextAtSize(text, 8), column.width - 4);
        write(cell, column.align === "right" ? x + column.width - 4 - textWidth : x, 8, f, column.width - 4);
        x += column.width;
      });
    };
    drawRow(columns.map((c) => c.header), bold);
    if (rows.length === 0) {
      drawRow(["Aucun élément.", ...columns.slice(1).map(() => "")], font);
    }
    rows.forEach((row) => drawRow(row, font));
  };

  write(`Rapport de fin de mois — ${report.label}`, MARGIN, 16, bold);
  y -= 16;
  write(
    `${report.organizationName}${report.accountLabel ? ` · ${report.accountLabel}` : " · tous les comptes"} · établi le ${formatDate(report.generatedOn)}`,
    MARGIN,
    9,
  );

  title(`Chèques et LCN débités : ${formatMAD(report.paidTotal)}`);
  table(
    [
      { header: "Fournisseur", width: 170 },
      { header: "Formule", width: 110 },
      { header: "Émis le", width: 60 },
      { header: "Débité le", width: 60 },
      { header: "Factures réglées", width: 280 },
      { header: "Montant", width: 90, align: "right" },
    ],
    report.paid.flatMap((group) =>
      group.payments.map((p) => [
        group.supplier,
        p.instrument,
        formatDate(p.issueDate),
        formatDate(p.debitedAt),
        p.invoices.map((i) => i.number).join(", "),
        formatMAD(p.amount),
      ]),
    ),
  );

  title(`En circulation : ${formatMAD(report.circulationTotal)}`);
  table(
    [
      { header: "Formule", width: 110 },
      { header: "Fournisseur", width: 190 },
      { header: "Émis le", width: 60 },
      { header: "Échéance", width: 60 },
      { header: "Statut", width: 60 },
      { header: "Ancienneté", width: 80 },
      { header: "Compte", width: 120 },
      { header: "Montant", width: 90, align: "right" },
    ],
    report.circulation.map((p) => [
      p.instrument,
      p.supplier,
      formatDate(p.issueDate),
      p.dueDate ? formatDate(p.dueDate) : "",
      p.delivered ? "Remis" : "Émis",
      `${p.ageDays} j (${p.bucket})`,
      p.account,
      formatMAD(p.amount),
    ]),
  );

  title("Anomalies");
  table(
    [
      { header: "Type", width: 150 },
      { header: "Date", width: 60 },
      { header: "Libellé ou formule", width: 250 },
      { header: "Détail", width: 200 },
      { header: "Montant", width: 110, align: "right" },
    ],
    [
      ...report.anomalies.amountMismatches.map((a) => [
        a.confirmed ? "Écart de montant (confirmé)" : "Écart de montant (à confirmer)",
        formatDate(a.date),
        a.label,
        `${a.instrument} émis ${formatMAD(a.paymentAmount)}`,
        formatMAD(a.lineAmount),
      ]),
      ...report.anomalies.unknownDebits.map((u) => ["Débit inconnu", formatDate(u.date), u.label, `n° ${u.number}`, formatMAD(u.amount)]),
      ...report.anomalies.missingNumbers.map((m) => ["Numéros manquants", "", m.checkbook, m.numbers.join(", "), ""]),
      ...report.anomalies.cancelled.map((c) => ["Annulé", "", c.instrument, `${c.supplier} — ${c.reason}`, formatMAD(c.amount)]),
    ],
  );

  return pdf.save();
}
