import { describe, expect, it } from "vitest";
import { allocatePayments, checkCustomSplit, MAX_INSTRUMENTS, scheduleDueDates, splitEqual } from "./split";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe("splitEqual", () => {
  it.each([
    [10000, 3, [3333, 3333, 3334]],
    [1000000, 2, [500000, 500000]],
    [1200000, 3, [400000, 400000, 400000]],
    [845050, 4, [211262, 211262, 211262, 211264]],
    [101, 2, [50, 51]],
    [5, 5, [1, 1, 1, 1, 1]],
    [999, 1, [999]],
  ])("%s centimes en %s → %j", (total, count, expected) => {
    expect(splitEqual(total, count)).toEqual(expected);
  });

  it("la somme des parts vaut toujours le total, l'écart sur la dernière", () => {
    for (const total of [1, 7, 100, 9999, 1234567, 99999999]) {
      for (let count = 1; count <= Math.min(MAX_INSTRUMENTS, total); count += 1) {
        const parts = splitEqual(total, count);
        expect(sum(parts)).toBe(total);
        expect(new Set(parts.slice(0, -1)).size).toBeLessThanOrEqual(1);
        expect(parts.at(-1)! - parts[0]).toBeGreaterThanOrEqual(0);
        expect(parts.at(-1)! - parts[0]).toBeLessThan(count);
      }
    }
  });

  it.each([
    [0, 1],
    [-100, 2],
    [10.5, 2],
    [3, 4],
    [1000, 0],
    [1000, MAX_INSTRUMENTS + 1],
  ])("refuse %s centimes en %s", (total, count) => {
    expect(() => splitEqual(total, count)).toThrow(RangeError);
  });
});

describe("checkCustomSplit", () => {
  it("accepte une répartition exacte", () => {
    expect(checkCustomSplit(10000, [5000, 3000, 2000])).toEqual({ ok: true });
  });

  it("signale l'écart restant à répartir", () => {
    expect(checkCustomSplit(10000, [5000, 3000])).toEqual({ ok: false, difference: 2000, invalidIndexes: [] });
    expect(checkCustomSplit(10000, [6000, 6000])).toEqual({ ok: false, difference: -2000, invalidIndexes: [] });
  });

  it("signale les parts nulles ou invalides", () => {
    expect(checkCustomSplit(10000, [10000, 0])).toEqual({ ok: false, difference: 0, invalidIndexes: [1] });
    expect(checkCustomSplit(10000, [Number.NaN, 10000])).toEqual({ ok: false, difference: 0, invalidIndexes: [0] });
  });
});

describe("scheduleDueDates", () => {
  it("échéances à 30, 60 et 90 jours", () => {
    expect(scheduleDueDates("2026-10-26", 3)).toEqual(["2026-11-25", "2026-12-25", "2027-01-24"]);
  });

  it("intervalle et premier décalage paramétrables", () => {
    expect(scheduleDueDates("2026-01-31", 2, 15, 0)).toEqual(["2026-01-31", "2026-02-15"]);
  });

  it("refuse un intervalle négatif", () => {
    expect(() => scheduleDueDates("2026-01-01", 2, -30)).toThrow(RangeError);
  });
});

describe("allocatePayments", () => {
  const invoices = [
    { invoiceId: "A", dueCents: 3000000 }, // 30 000
    { invoiceId: "B", dueCents: 1200000 }, // 12 000
  ];

  it("une facture réglée par plusieurs chèques", () => {
    expect(allocatePayments([2400000, 2400000], [{ invoiceId: "F", dueCents: 4800000 }])).toEqual([
      { paymentIndex: 0, invoiceId: "F", amountCents: 2400000 },
      { paymentIndex: 1, invoiceId: "F", amountCents: 2400000 },
    ]);
  });

  it("un chèque qui règle plusieurs factures, dans l'ordre", () => {
    expect(allocatePayments([4200000], invoices)).toEqual([
      { paymentIndex: 0, invoiceId: "A", amountCents: 3000000 },
      { paymentIndex: 0, invoiceId: "B", amountCents: 1200000 },
    ]);
  });

  it("plusieurs paiements à cheval sur plusieurs factures", () => {
    const allocations = allocatePayments([2100000, 2100000], invoices);
    expect(allocations).toEqual([
      { paymentIndex: 0, invoiceId: "A", amountCents: 2100000 },
      { paymentIndex: 1, invoiceId: "A", amountCents: 900000 },
      { paymentIndex: 1, invoiceId: "B", amountCents: 1200000 },
    ]);
  });

  it("règlement partiel : la seconde facture n'est pas touchée", () => {
    expect(allocatePayments([1000000], invoices)).toEqual([{ paymentIndex: 0, invoiceId: "A", amountCents: 1000000 }]);
  });

  it("l'excédent est affecté à la dernière facture", () => {
    const allocations = allocatePayments([5000000], invoices);
    expect(allocations).toEqual([
      { paymentIndex: 0, invoiceId: "A", amountCents: 3000000 },
      { paymentIndex: 0, invoiceId: "B", amountCents: 2000000 },
    ]);
  });

  it("chaque paiement est entièrement affecté, et rien de plus", () => {
    const payments = splitEqual(4200000, 7);
    const allocations = allocatePayments(payments, invoices);
    payments.forEach((amount, index) => {
      expect(sum(allocations.filter((a) => a.paymentIndex === index).map((a) => a.amountCents))).toBe(amount);
    });
    expect(sum(allocations.filter((a) => a.invoiceId === "A").map((a) => a.amountCents))).toBe(3000000);
  });

  it("sans facture : aucune affectation", () => {
    expect(allocatePayments([1000], [])).toEqual([]);
  });
});
