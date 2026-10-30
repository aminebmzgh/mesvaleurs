import { describe, expect, it } from "vitest";
import {
  addMonths,
  type ComplianceInvoice,
  type CompliancePayment,
  complianceIndicators,
  declarationDeadline,
  declarationReminder,
  declarationRequired,
  type LegalParams,
  lateFine,
  monthsLate,
  parseQuarterKey,
  paymentDate,
  quarterOf,
  quarterRange,
  quarterStatement,
} from "./late-payments";

const params: LegalParams = {
  firstMonthRate: 2.25,
  additionalMonthRate: 0.85,
  minInvoiceAmount: 0,
  declarationMonthsAfterQuarter: 1,
  revenueThreshold: 2_000_000,
};

const payment = (overrides: Partial<CompliancePayment> = {}): CompliancePayment => ({
  type: "check",
  status: "delivered",
  reference: "0001234",
  issueDate: "2026-08-10",
  deliveredAt: null,
  dueDate: null,
  debitedAt: null,
  ...overrides,
});

const invoice = (overrides: Partial<ComplianceInvoice> = {}): ComplianceInvoice => ({
  id: "i1",
  number: "F-001",
  issueDate: "2026-05-01",
  legalDueDate: "2026-06-30",
  amount: 10_000,
  status: "unpaid",
  supplier: { name: "Sotrama", ice: "001234567000089" },
  allocations: [],
  ...overrides,
});

describe("paymentDate", () => {
  it("remise du chèque (sinon émission), échéance de la LCN, date du virement", () => {
    expect(paymentDate(payment({ deliveredAt: "2026-08-12" }), "remittance")).toBe("2026-08-12");
    expect(paymentDate(payment(), "remittance")).toBe("2026-08-10");
    expect(paymentDate(payment({ type: "lcn", dueDate: "2026-09-30" }), "remittance")).toBe("2026-09-30");
    expect(paymentDate(payment({ type: "transfer", issueDate: "2026-08-11" }), "remittance")).toBe("2026-08-11");
  });

  it("base « débit » : inconnue tant que non débité", () => {
    expect(paymentDate(payment(), "debit")).toBeNull();
    expect(paymentDate(payment({ debitedAt: "2026-08-20" }), "debit")).toBe("2026-08-20");
  });
});

describe("mois de retard et amende", () => {
  it("fin de mois conservée", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("tout mois commencé compte", () => {
    expect(monthsLate("2026-06-30", "2026-06-30")).toBe(0);
    expect(monthsLate("2026-06-30", "2026-07-01")).toBe(1);
    expect(monthsLate("2026-06-30", "2026-07-30")).toBe(1);
    expect(monthsLate("2026-06-30", "2026-07-31")).toBe(2);
    expect(monthsLate("2026-06-30", "2026-10-15")).toBe(4);
  });

  it("2,25 % le premier mois, puis 0,85 % par mois ; seuil de montant", () => {
    expect(lateFine(10_000, 1, 10_000, params)).toBe(225);
    expect(lateFine(10_000, 4, 10_000, params)).toBe(480);
    expect(lateFine(10_000, 0, 10_000, params)).toBe(0);
    expect(lateFine(500, 3, 500, { ...params, minInvoiceAmount: 1000 })).toBe(0);
  });
});

describe("trimestres", () => {
  it("bornes, clé et date limite de déclaration", () => {
    expect(quarterOf("2026-10-31")).toEqual({ year: 2026, quarter: 4 });
    expect(quarterRange({ year: 2026, quarter: 1 })).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(parseQuarterKey("2026-T3")).toEqual({ year: 2026, quarter: 3 });
    expect(parseQuarterKey("2026-T5")).toBeNull();
    expect(declarationDeadline({ year: 2026, quarter: 3 }, params)).toBe("2026-10-31");
    expect(declarationDeadline({ year: 2026, quarter: 4 }, params)).toBe("2027-01-31");
    expect(declarationDeadline({ year: 2026, quarter: 1 }, { declarationMonthsAfterQuarter: 2 })).toBe("2026-05-31");
  });
});

describe("quarterStatement", () => {
  const q3 = { year: 2026, quarter: 3 };

  it("payée hors délai pendant le trimestre : une ligne par paiement", () => {
    const rows = quarterStatement(
      [
        invoice({
          allocations: [
            { amount: 6_000, payment: payment({ issueDate: "2026-08-10" }) },
            { amount: 4_000, payment: payment({ type: "lcn", reference: "5000150", dueDate: "2026-06-15" }) },
          ],
        }),
      ],
      q3,
      "remittance",
      params,
    );
    expect(rows).toEqual([
      expect.objectContaining({ kind: "late_paid", amount: 6_000, paidOn: "2026-08-10", monthsLate: 2, fine: 186, paymentReference: "0001234" }),
    ]);
  });

  it("reste impayé et échu à la fin du trimestre, retard compté jusqu'à cette date", () => {
    const rows = quarterStatement(
      [invoice({ allocations: [{ amount: 2_500, payment: payment({ issueDate: "2026-06-20" }) }] })],
      q3,
      "remittance",
      params,
    );
    expect(rows).toEqual([expect.objectContaining({ kind: "unpaid", amount: 7_500, monthsLate: 3, fine: round(7_500 * 0.0395) })]);
  });

  it("hors champ : payée dans le délai, payée un autre trimestre, pas encore échue, paiements annulés ou de garantie", () => {
    const rows = quarterStatement(
      [
        invoice({ id: "a", allocations: [{ amount: 10_000, payment: payment({ issueDate: "2026-06-29" }) }] }),
        invoice({ id: "b", allocations: [{ amount: 10_000, payment: payment({ issueDate: "2026-10-02" }) }], legalDueDate: "2026-09-30" }),
        invoice({ id: "c", legalDueDate: "2026-10-15" }),
        invoice({
          id: "d",
          legalDueDate: "2026-03-31",
          allocations: [{ amount: 10_000, payment: payment({ issueDate: "2026-04-15" }) }],
        }),
      ],
      q3,
      "remittance",
      params,
    );
    expect(rows).toEqual([]);

    const cancelled = quarterStatement(
      [invoice({ allocations: [{ amount: 10_000, payment: payment({ status: "cancelled", issueDate: "2026-06-01" }) }] })],
      q3,
      "remittance",
      params,
    );
    expect(cancelled).toEqual([expect.objectContaining({ kind: "unpaid", amount: 10_000 })]);
  });

  it("base « débit » : chèque non débité à la fin du trimestre = impayé", () => {
    const rows = quarterStatement(
      [invoice({ allocations: [{ amount: 10_000, payment: payment({ issueDate: "2026-06-01" }) }] })],
      q3,
      "debit",
      params,
    );
    expect(rows.map((row) => row.kind)).toEqual(["unpaid"]);
  });
});

const round = (value: number) => Math.round(value * 100) / 100;

describe("indicateurs et rappel", () => {
  it("dans les délais, proches de la date limite, en retard (litiges exclus)", () => {
    const indicators = complianceIndicators(
      [
        invoice({ id: "a", legalDueDate: "2026-12-31", amount: 100 }),
        invoice({ id: "b", legalDueDate: "2026-11-03", amount: 200 }),
        invoice({ id: "c", legalDueDate: "2026-10-01", amount: 300, allocations: [{ amount: 50, payment: payment({ issueDate: "2026-09-01" }) }] }),
        invoice({ id: "d", legalDueDate: "2026-10-01", status: "disputed" }),
        invoice({ id: "e", legalDueDate: "2026-10-01", amount: 80, allocations: [{ amount: 80, payment: payment({ issueDate: "2026-09-01" }) }] }),
      ],
      "2026-10-31",
      7,
      "remittance",
    );
    expect(indicators).toEqual({
      onTime: { count: 1, amount: 100 },
      dueSoon: { count: 1, amount: 200 },
      late: { count: 1, amount: 250 },
    });
  });

  it("rappel du trimestre écoulé, à partir de N jours avant la date limite, jusqu'à la déclaration", () => {
    expect(declarationReminder("2026-10-10", [], 15, params)).toBeNull();
    expect(declarationReminder("2026-10-16", [], 15, params)).toEqual({ quarter: { year: 2026, quarter: 3 }, deadline: "2026-10-31", daysLeft: 15 });
    expect(declarationReminder("2026-11-05", [], 15, params)?.daysLeft).toBe(-5);
    expect(declarationReminder("2026-10-20", [{ year: 2026, quarter: 3 }], 15, params)).toBeNull();
    expect(declarationReminder("2027-01-20", [], 15, params)?.quarter).toEqual({ year: 2026, quarter: 4 });
  });

  it("obligation selon le chiffre d'affaires", () => {
    expect(declarationRequired(null, params)).toBe(true);
    expect(declarationRequired(1_500_000, params)).toBe(false);
    expect(declarationRequired(2_000_000, params)).toBe(true);
  });
});
