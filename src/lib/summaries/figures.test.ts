import { describe, expect, it } from "vitest";
import { computeMonthlySummary, previousMonth, type SummaryInvoice, type SummaryPayment } from "./figures";

const params = { firstMonthRate: 2.25, additionalMonthRate: 0.85, minInvoiceAmount: 0, declarationMonthsAfterQuarter: 1, revenueThreshold: 2_000_000 };
const payment = (over: Partial<SummaryPayment>): SummaryPayment => ({
  type: "check",
  status: "issued",
  amount: 1000,
  issueDate: "2026-10-10",
  dueDate: null,
  debitedAt: null,
  regularizedAt: null,
  ...over,
});
const invoice = (over: Partial<SummaryInvoice>): SummaryInvoice => ({
  number: "F-1",
  supplier: "Sotrama",
  legalDueDate: "2026-12-31",
  amountInclTax: 10000,
  amountPaid: 0,
  status: "unpaid",
  ...over,
});

describe("previousMonth", () => {
  it("mois civil précédent, changement d'année compris", () => {
    expect(previousMonth("2026-11-01")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(previousMonth("2027-01-01")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(previousMonth("2026-03-01")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

describe("computeMonthlySummary", () => {
  const month = { start: "2026-10-01", end: "2026-10-31" };
  const today = "2026-11-01";

  it("payé dans le mois, émis dans le mois, en circulation", () => {
    const summary = computeMonthlySummary({
      month,
      today,
      balance: 0,
      params,
      invoices: [],
      payments: [
        payment({ status: "paid", debitedAt: "2026-10-15", amount: 1500 }),
        payment({ type: "lcn", status: "paid", debitedAt: "2026-10-20", amount: 4000, issueDate: "2026-07-01" }),
        payment({ type: "transfer", status: "paid", debitedAt: "2026-10-21", amount: 250.5 }),
        // Débité le mois précédent : hors résumé
        payment({ status: "paid", debitedAt: "2026-09-30", issueDate: "2026-09-20" }),
        payment({ status: "issued", amount: 800, issueDate: "2026-10-25" }),
        payment({ status: "cancelled", issueDate: "2026-10-26" }),
        payment({ type: "guarantee_check", status: "issued", amount: 99999, issueDate: "2026-10-02" }),
      ],
    });
    expect(summary.paid).toEqual({
      count: 3,
      total: 5750.5,
      checks: { count: 1, total: 1500 },
      lcns: { count: 1, total: 4000 },
      transfers: { count: 1, total: 250.5 },
    });
    expect(summary.issued).toEqual({ count: 3, total: 2550.5 });
    expect(summary.remaining.inCirculation).toEqual({ count: 1, total: 800 });
  });

  it("factures à payer, en retard (amende indicative), à échéance dans 30 jours ; contestées exclues", () => {
    const summary = computeMonthlySummary({
      month,
      today,
      balance: 50000,
      params,
      payments: [payment({ type: "lcn", status: "delivered", dueDate: "2026-11-20", amount: 3000 }), payment({ status: "rejected", amount: 700 })],
      invoices: [
        invoice({ number: "LATE-1", legalDueDate: "2026-10-15", amountInclTax: 20000, amountPaid: 5000 }),
        invoice({ number: "SOON-1", legalDueDate: "2026-11-25", amountInclTax: 2000 }),
        invoice({ number: "LATER", legalDueDate: "2027-01-15", amountInclTax: 1000 }),
        invoice({ number: "DISPUTED", legalDueDate: "2026-09-01", status: "disputed" }),
        invoice({ number: "PAID", amountPaid: 10000, status: "paid" }),
      ],
    });
    expect(summary.remaining.invoices).toEqual({ count: 3, total: 18000 });
    expect(summary.risks.late).toEqual({
      count: 1,
      total: 15000,
      fines: 337.5,
      listed: [{ number: "LATE-1", supplier: "Sotrama", remaining: 15000, legalDueDate: "2026-10-15" }],
    });
    expect(summary.risks.dueSoon).toEqual({ count: 1, total: 2000 });
    expect(summary.risks.lcnDueSoon).toEqual({ count: 1, total: 3000 });
    expect(summary.risks.rejected).toEqual({ count: 1, total: 700 });
    // 50 000 − (3 000 en circulation + 15 000 en retard + 2 000 à échéance)
    expect(summary.risks.coverage).toEqual({ balance: 50000, commitments: 20000, gap: 30000 });
  });
});
