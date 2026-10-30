import { describe, expect, it } from "vitest";
import type { ParsedLine } from "@/lib/statements/parse";
import { compareSupplierStatement, invoiceKey, type OurInvoice, type OurPayment } from "./statement-match";

const line = (operationDate: string, label: string, debit: number | null, credit: number | null, reference: string | null = null): ParsedLine => ({
  operationDate,
  valueDate: null,
  label,
  reference,
  debit,
  credit,
});

const invoices: OurInvoice[] = [
  { id: "i1", number: "F2026-0012", issueDate: "2026-10-03", amount: 12000 },
  { id: "i2", number: "F2026-0015", issueDate: "2026-10-10", amount: 5000 },
  { id: "i3", number: "F2026-0018", issueDate: "2026-10-20", amount: 800 },
  { id: "i4", number: "BL-77", issueDate: "2026-10-22", amount: 450 },
  // Hors période du relevé : ignorée
  { id: "i5", number: "F2026-0002", issueDate: "2026-08-01", amount: 999 },
];
const payments: OurPayment[] = [
  { id: "p1", label: "Chèque 0001003", number: 1003, reference: null, date: "2026-10-12", amount: 12000, delivered: true },
  { id: "p2", label: "LCN 5000102", number: 5000102, reference: null, date: "2026-10-25", amount: 2500, delivered: false },
  { id: "p3", label: "Virement VIR-118", number: null, reference: "VIR-118", date: "2026-10-15", amount: 300, delivered: true },
];

const statement = [
  line("2026-10-01", "Solde reporté", 4000, null),
  line("2026-10-03", "Facture", 12000, null, "F2026/12"),
  line("2026-10-10", "FACTURE F2026-0015 DU 10/10", 5200, null),
  line("2026-10-12", "Règlement chèque n° 1003", null, 12000),
  line("2026-10-15", "Virement reçu", null, 300, "VIR 118"),
  line("2026-10-21", "Facture", 800, null, "FA-0018"),
  line("2026-10-22", "Avoir", null, 450),
  line("2026-10-28", "Facture", 1500, null, "F2026-0021"),
];

describe("invoiceKey", () => {
  it("ignore séparateurs, casse et zéros initiaux", () => {
    expect(invoiceKey("F2026/12")).toBe(invoiceKey("f2026-0012"));
    expect(invoiceKey("BL 077")).toBe("BL77");
  });
});

describe("compareSupplierStatement", () => {
  const result = compareSupplierStatement(statement, invoices, payments);
  const find = (predicate: (row: (typeof result.rows)[number]) => boolean) => result.rows.find(predicate);

  it("période du relevé, lignes de solde écartées", () => {
    expect(result.period).toEqual({ start: "2026-10-03", end: "2026-10-28" });
    expect(result.skipped).toBe(1);
  });

  it("factures retrouvées par numéro, écart de montant signalé", () => {
    expect(find((row) => row.ours?.id === "i1")).toMatchObject({ status: "matched", probable: false, difference: 0 });
    expect(find((row) => row.ours?.id === "i2")).toMatchObject({ status: "amount_diff", difference: 200 });
  });

  it("paiements retrouvés par numéro de chèque ou référence de virement", () => {
    expect(find((row) => row.ours?.id === "p1")).toMatchObject({ kind: "payment", status: "matched" });
    expect(find((row) => row.ours?.id === "p3")).toMatchObject({ status: "matched", probable: false });
  });

  it("numéro différent : rapprochement probable par montant et date", () => {
    expect(find((row) => row.ours?.id === "i3")).toMatchObject({ status: "matched", probable: true });
  });

  it("absents chez nous, absents chez le fournisseur", () => {
    expect(find((row) => row.theirs?.reference === "F2026-0021")).toMatchObject({ kind: "invoice", status: "missing_ours", difference: 1500 });
    // Avoir de 450 : un crédit sans paiement correspondant chez nous
    expect(find((row) => row.theirs?.label === "Avoir")).toMatchObject({ kind: "payment", status: "missing_ours" });
    expect(find((row) => row.ours?.id === "i4")).toMatchObject({ status: "missing_theirs", difference: -450 });
    expect(find((row) => row.ours?.id === "p2")).toMatchObject({ status: "missing_theirs" });
    expect(find((row) => row.ours?.id === "i5")).toBeUndefined();
  });

  it("soldes de la période et écart", () => {
    // Fournisseur : 12000 + 5200 + 800 + 1500 − 12000 − 300 − 450 = 6750
    // Nous : 12000 + 5000 + 800 + 450 − 12000 − 2500 − 300 = 3450
    expect(result.totals).toEqual({ theirs: 6750, ours: 3450, difference: 3300 });
  });

  it("relevé tenu à l'envers : factures au crédit", () => {
    const swapped = statement.map((entry) => ({ ...entry, debit: entry.credit, credit: entry.debit }));
    const other = compareSupplierStatement(swapped, invoices, payments, { swapSides: true });
    expect(other.totals).toEqual(result.totals);
  });
});
