/**
 * Exports des listes (spec §11.2) : un même tableau rendu en CSV, Excel ou PDF.
 * Montants en nombre (Excel) ou au format français (CSV, PDF), dates réelles en Excel.
 */

import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { formatAmount, formatDate } from "@/lib/format";
import { toWinAnsi } from "@/lib/printing/measure";

export type ColumnKind = "text" | "amount" | "date" | "integer";
export type ExportColumn = { header: string; kind: ColumnKind; width: number };
export type ExportCell = string | number | null;
export type ExportTable = { title: string; subtitle?: string; columns: ExportColumn[]; rows: ExportCell[][] };

export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === "string" && (EXPORT_FORMATS as readonly string[]).includes(value);
}

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/** Valeur affichée d'une cellule (CSV, PDF). */
export function displayCell(value: ExportCell, kind: ColumnKind): string {
  if (value === null || value === "") {
    return "";
  }
  if (kind === "amount" && typeof value === "number") {
    return formatAmount(value);
  }
  if (kind === "date" && typeof value === "string") {
    return formatDate(value);
  }
  return String(value);
}

/**
 * CSV pour Excel en français : séparateur « ; », virgule décimale sans séparateur de
 * milliers, BOM UTF-8 (accents lus correctement à l'ouverture).
 */
export function toCsv(table: ExportTable): string {
  const escape = (text: string) => (/[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text);
  const cell = (value: ExportCell, kind: ColumnKind) => {
    if (kind === "amount" && typeof value === "number") {
      return value.toFixed(2).replace(".", ",");
    }
    return escape(displayCell(value, kind));
  };
  const lines = [
    table.columns.map((c) => escape(c.header)).join(";"),
    ...table.rows.map((row) => row.map((value, i) => cell(value, table.columns[i].kind)).join(";")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Classeur Excel d'une feuille : montants numériques (#,##0.00), dates réelles. */
export function toXlsx(table: ExportTable): Buffer {
  const rows = table.rows.map((row) =>
    row.map((value, i) => (table.columns[i].kind === "date" && typeof value === "string" && value ? new Date(`${value}T00:00:00Z`) : value)),
  );
  const ws = XLSX.utils.aoa_to_sheet([table.columns.map((c) => c.header), ...rows], { cellDates: true });
  ws["!cols"] = table.columns.map((c) => ({ wch: c.width }));
  for (const address of Object.keys(ws)) {
    const cell = ws[address];
    if (address.startsWith("!") || !cell || typeof cell !== "object") {
      continue;
    }
    if (cell.t === "n") {
      cell.z = table.columns[XLSX.utils.decode_cell(address).c]?.kind === "integer" ? "0" : "#,##0.00";
    } else if (cell.t === "d") {
      cell.z = "dd/mm/yyyy";
    }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, table.title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const [PAGE_W, PAGE_H, MARGIN] = [841.89, 595.28, 32];

function fit(text: string, font: PDFFont, size: number, width: number): string {
  let value = toWinAnsi(text);
  while (value.length > 1 && font.widthOfTextAtSize(value, size) > width) {
    value = `${value.slice(0, -2)}…`;
  }
  return value;
}

/** PDF A4 paysage : titre, en-têtes répétés à chaque page, colonnes proportionnelles. */
export async function toPdf(table: ExportTable): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(table.title);
  pdf.setCreator("MesValeurs");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const totalWidth = table.columns.reduce((sum, c) => sum + c.width, 0);
  const widths = table.columns.map((c) => (c.width / totalWidth) * (PAGE_W - 2 * MARGIN));
  const size = 8;
  const rowHeight = 13;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageNumber = 1;
  const footer = () =>
    page.drawText(toWinAnsi(`${table.title} · page ${pageNumber}`), { x: MARGIN, y: 16, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  const drawRow = (cells: string[], f: PDFFont, kinds: ColumnKind[]) => {
    let x = MARGIN;
    cells.forEach((text, i) => {
      const value = fit(text, f, size, widths[i] - 6);
      const right = kinds[i] === "amount" || kinds[i] === "integer";
      const w = f.widthOfTextAtSize(value, size);
      page.drawText(value, { x: right ? x + widths[i] - 3 - w : x + 3, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      x += widths[i];
    });
  };
  const header = () => {
    drawRow(table.columns.map((c) => c.header), bold, table.columns.map((c) => c.kind));
    page.drawLine({ start: { x: MARGIN, y: y - 4 }, end: { x: PAGE_W - MARGIN, y: y - 4 }, thickness: 0.5, color: rgb(0.5, 0.5, 0.5) });
    y -= rowHeight + 2;
  };

  page.drawText(toWinAnsi(table.title), { x: MARGIN, y, size: 13, font: bold });
  y -= 16;
  if (table.subtitle) {
    page.drawText(toWinAnsi(table.subtitle), { x: MARGIN, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 14;
  }
  y -= 6;
  header();
  footer();
  for (const row of table.rows) {
    if (y < MARGIN + rowHeight) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      pageNumber += 1;
      y = PAGE_H - MARGIN;
      header();
      footer();
    }
    drawRow(row.map((value, i) => displayCell(value, table.columns[i].kind)), font, table.columns.map((c) => c.kind));
    y -= rowHeight;
  }
  if (table.rows.length === 0) {
    page.drawText(toWinAnsi("Aucune ligne."), { x: MARGIN, y, size, font });
  }
  return pdf.save();
}
