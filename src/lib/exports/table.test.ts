import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { formatAmount } from "@/lib/format";
import { invoicesTable } from "./lists";
import { displayCell, type ExportTable, isExportFormat, toCsv, toPdf, toXlsx } from "./table";

const table: ExportTable = {
  title: "Factures",
  subtitle: "Atlas · export",
  columns: [
    { header: "Numéro", kind: "text", width: 12 },
    { header: "Date", kind: "date", width: 10 },
    { header: "Montant", kind: "amount", width: 12 },
    { header: "Jours", kind: "integer", width: 6 },
  ],
  rows: [
    ['F-1; "spéciale"', "2026-10-28", 1234.5, 30],
    ["F-2", null, 0, null],
  ],
};

describe("toCsv", () => {
  it("BOM, séparateur « ; », virgule décimale, échappement", () => {
    const csv = toCsv(table);
    expect(csv.startsWith(String.fromCharCode(0xfeff))).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual(["Numéro;Date;Montant;Jours", '"F-1; ""spéciale""";28/10/2026;1234,50;30', "F-2;;0,00;", ""]);
  });
});

describe("toXlsx", () => {
  it("montants numériques et dates réelles", () => {
    const sheet = XLSX.read(toXlsx(table), { cellDates: true, cellNF: true }).Sheets.Factures;
    expect(sheet.C2.v).toBe(1234.5);
    expect(sheet.C2.z).toBe("#,##0.00");
    expect(sheet.B2.v).toBeInstanceOf(Date);
    expect(sheet.D2.z).toBe("0");
  });
});

describe("toPdf", () => {
  it("paysage, pagination des longues listes", async () => {
    const long = { ...table, rows: Array.from({ length: 120 }, (_, i) => [`F-${i}`, "2026-10-28", i, i]) };
    const doc = await PDFDocument.load(await toPdf(long));
    expect(doc.getPageCount()).toBeGreaterThan(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
  });
});

describe("displayCell / isExportFormat", () => {
  it("formats affichés et formats acceptés", () => {
    expect(displayCell(1234.5, "amount")).toBe(formatAmount(1234.5));
    expect(displayCell("2026-10-28", "date")).toBe("28/10/2026");
    expect(displayCell(null, "text")).toBe("");
    expect(isExportFormat("xlsx")).toBe(true);
    expect(isExportFormat("docx")).toBe(false);
  });
});

describe("invoicesTable", () => {
  it("reste dû calculé et statut en clair", () => {
    const t = invoicesTable(
      [{ number: "F-1", issue_date: "2026-10-01", legal_due_date: "2026-11-30", amount_incl_tax: 1200, amount_paid: 200.4, amount_cashed: 0, status: "partially_paid", suppliers: { name: "Atlas" } }],
      "",
    );
    expect(t.rows[0]).toEqual(["F-1", "Atlas", "2026-10-01", "2026-11-30", 1200, 200.4, 0, 999.6, "Partiellement payée"]);
  });
});
