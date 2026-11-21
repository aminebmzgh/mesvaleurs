import { describe, expect, it } from "vitest";
import { type PortalPayment, PORTAL_TOKEN_PATTERN, portalStatus, portalTotals, portalUrl } from "./portal";

const payment = (overrides: Partial<PortalPayment>): PortalPayment => ({
  id: "p",
  type: "check",
  status: "issued",
  number: 1000,
  reference: null,
  amount: 1000,
  issueDate: "2026-11-01",
  dueDate: null,
  deliveredAt: null,
  debitedAt: null,
  rejectedAt: null,
  regularizedAt: null,
  bank: "Attijariwafa bank",
  invoices: [],
  ...overrides,
});

describe("portalUrl", () => {
  it("construit le lien sans double barre", () => {
    expect(portalUrl("https://mesvaleurs.ma/", "a".repeat(32))).toBe(`https://mesvaleurs.ma/suivi/${"a".repeat(32)}`);
  });

  it("reconnaît un jeton valide", () => {
    expect(PORTAL_TOKEN_PATTERN.test("Ab3_-".padEnd(32, "x"))).toBe(true);
    expect(PORTAL_TOKEN_PATTERN.test("trop-court")).toBe(false);
    expect(PORTAL_TOKEN_PATTERN.test("a".repeat(31) + "/")).toBe(false);
  });
});

describe("portalStatus", () => {
  it("suit un chèque de l'émission à l'encaissement", () => {
    expect(portalStatus(payment({ status: "issued" }))).toEqual({ label: "Prêt, à remettre", tone: "pending", date: null });
    expect(portalStatus(payment({ status: "delivered", deliveredAt: "2026-11-02" }))).toEqual({
      label: "Remis, à encaisser",
      tone: "progress",
      date: "2026-11-02",
    });
    expect(portalStatus(payment({ status: "paid", debitedAt: "2026-11-10" }))).toEqual({ label: "Encaissé", tone: "done", date: "2026-11-10" });
  });

  it("distingue un rejet régularisé", () => {
    expect(portalStatus(payment({ status: "rejected", rejectedAt: "2026-11-05" })).tone).toBe("problem");
    expect(portalStatus(payment({ status: "rejected", rejectedAt: "2026-11-05", regularizedAt: "2026-11-08" }))).toEqual({
      label: "Rejeté, régularisé",
      tone: "done",
      date: "2026-11-08",
    });
  });

  it("parle de virement ordonné puis exécuté", () => {
    expect(portalStatus(payment({ type: "transfer", status: "issued" })).label).toBe("Virement ordonné");
    expect(portalStatus(payment({ type: "transfer", status: "paid", debitedAt: "2026-11-03" })).label).toBe("Virement exécuté");
  });
});

describe("portalTotals", () => {
  it("additionne au centime près par étape et calcule le reste dû", () => {
    const totals = portalTotals({
      payments: [
        payment({ status: "issued", amount: 0.1 }),
        payment({ status: "issued", amount: 0.2 }),
        payment({ status: "delivered", amount: 500 }),
        payment({ status: "paid", amount: 1200.5 }),
        payment({ status: "rejected", amount: 300 }),
      ],
      openInvoices: [
        { number: "A", issueDate: "2026-10-01", dueDate: null, amountInclTax: 1000, amountPaid: 400, disputed: false },
        { number: "B", issueDate: "2026-10-02", dueDate: null, amountInclTax: 99.99, amountPaid: 0, disputed: true },
      ],
    });
    expect(totals).toEqual({ pending: 0.3, inProgress: 500, done: 1200.5, outstanding: 699.99 });
  });
});
