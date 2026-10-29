import { describe, expect, it } from "vitest";
import { computeStatistics, monthsBetween, type StatPayment, topSuppliers } from "./stats";

const payment = (overrides: Partial<StatPayment>): StatPayment => ({
  type: "check",
  amount: 1000,
  issueDate: "2026-10-10",
  paidOn: "2026-10-10",
  supplier: { id: "s1", name: "Sotrama" },
  allocations: [],
  ...overrides,
});

describe("monthsBetween", () => {
  it("mois inclus, passage d'année", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsBetween("2026-10", "2026-10")).toEqual(["2026-10"]);
  });
});

describe("computeStatistics", () => {
  const stats = computeStatistics(
    [
      payment({ amount: 1000.1, allocations: [{ amount: 1000.1, invoiceDate: "2026-09-10" }] }),
      payment({ type: "lcn", amount: 3000, issueDate: "2026-09-05", paidOn: "2026-09-20", allocations: [{ amount: 3000, invoiceDate: "2026-09-10" }] }),
      payment({ type: "transfer", amount: 999.9, supplier: { id: "s2", name: "Atlas" }, allocations: [{ amount: 999.9, invoiceDate: "2026-10-30" }] }),
    ],
    monthsBetween("2026-08", "2026-10"),
  );

  it("totaux par mois (mois sans paiement à zéro) et par type", () => {
    expect(stats.total).toBe(5000);
    expect(stats.byMonth).toEqual([
      { month: "2026-08", total: 0, count: 0 },
      { month: "2026-09", total: 3000, count: 1 },
      { month: "2026-10", total: 2000, count: 2 },
    ]);
    expect(stats.byType.lcn).toEqual({ total: 3000, count: 1, share: 60 });
    expect(stats.byType.check.share + stats.byType.lcn.share + stats.byType.transfer.share).toBeCloseTo(100, 0);
  });

  it("fournisseurs triés par montant, délai moyen pondéré par les montants réglés", () => {
    expect(stats.bySupplier.map((s) => [s.name, s.total, s.count])).toEqual([
      ["Sotrama", 4000.1, 2],
      ["Atlas", 999.9, 1],
    ]);
    // Sotrama : 30 j pour 1 000,10 et 10 j pour 3 000 → 15 j
    expect(stats.bySupplier[0].averageDelay).toBe(15);
    // Atlas : paiement antérieur à la facture → délai nul
    expect(stats.bySupplier[1].averageDelay).toBe(0);
  });

  it("aucun paiement : délai inconnu", () => {
    expect(computeStatistics([], ["2026-10"]).averageDelay).toBeNull();
  });
});

describe("topSuppliers", () => {
  it("regroupe les suivants en « Autres »", () => {
    const list = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, name: `F${i}`, total: 100 - i, count: 1, averageDelay: null }));
    const top = topSuppliers(list, 8);
    expect(top).toHaveLength(9);
    expect(top.at(-1)).toEqual({ name: "Autres (2)", total: 183, other: true });
  });
});
