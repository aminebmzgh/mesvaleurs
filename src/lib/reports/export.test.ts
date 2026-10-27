import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { reportPdf, reportWorkbook } from "./export";
import type { MonthlyReport } from "./monthly";

const report: MonthlyReport = {
  month: "2026-10",
  label: "octobre 2026",
  organizationName: "Atlas Distribution SARL",
  accountLabel: null,
  generatedOn: "2026-10-31",
  paid: [
    {
      supplier: "Sotrama Matériaux SARL",
      total: 48000,
      payments: [
        { id: "1", instrument: "Chèque 0001000", amount: 24000, issueDate: "2026-09-25", debitedAt: "2026-10-03", account: "Compte principal", invoices: [{ number: "F-2026-0412", amount: 24000 }] },
        { id: "2", instrument: "Chèque 0001001", amount: 24000, issueDate: "2026-09-25", debitedAt: "2026-10-06", account: "Compte principal", invoices: [{ number: "F-2026-0412", amount: 24000 }] },
      ],
    },
  ],
  paidTotal: 48000,
  circulation: Array.from({ length: 60 }, (_, i) => ({
    id: `c${i}`,
    instrument: `Chèque ${String(2000 + i).padStart(7, "0")}`,
    supplier: "Maghreb Emballages SA",
    account: "Compte principal",
    amount: 1000 + i,
    issueDate: "2026-07-21",
    dueDate: null,
    delivered: i % 2 === 0,
    ageDays: 102,
    bucket: "> 90 j" as const,
  })),
  circulationTotal: 61770,
  anomalies: {
    amountMismatches: [{ date: "2026-10-15", label: "CHEQUE 1002", lineAmount: 15060, instrument: "Chèque 0001002", paymentAmount: 15600, confirmed: false }],
    unknownDebits: [{ date: "2026-10-20", label: "CHQ 0001017", number: 1017, amount: 3200 }],
    missingNumbers: [{ checkbook: "Chéquier Compte principal", numbers: ["0001008"] }],
    cancelled: [{ instrument: "Chèque 0001004", supplier: "Centrale Agro Distribution", amount: 12000, reason: "Erreur d'impression" }],
  },
};

describe("reportWorkbook", () => {
  it("quatre feuilles, montants numériques et dates réelles", () => {
    const workbook = XLSX.read(reportWorkbook(report), { type: "buffer", cellDates: true });
    expect(workbook.SheetNames).toEqual(["Synthèse", "Débités", "En circulation", "Anomalies"]);
    const paid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Débités"], { header: 1, raw: true });
    expect(paid[1][5]).toBe(24000);
    expect(paid[1][4]).toBeInstanceOf(Date);
    const anomalies = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Anomalies, { header: 1, raw: true });
    expect(anomalies).toHaveLength(5); // en-tête + 4 anomalies
  });
});

describe("reportPdf", () => {
  it("paginé quand les tableaux sont longs", async () => {
    const pdf = await PDFDocument.load(await reportPdf(report));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 842, height: 595 });
  });
});
