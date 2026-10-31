import { describe, expect, it } from "vitest";
import type { LegalParams } from "@/lib/compliance/late-payments";
import { addDays } from "@/lib/dates";
import { buildPaymentPlan, type PlanInvoice } from "./plan";

const TODAY = "2026-11-02";
const PARAMS: LegalParams = {
  firstMonthRate: 2.25,
  additionalMonthRate: 0.85,
  minInvoiceAmount: 0,
  declarationMonthsAfterQuarter: 1,
  revenueThreshold: 2_000_000,
};

/** Solde constant sur 90 jours, avec des débits déjà prévus : { jour: montant }. */
function balances(opening: number, debits: Record<number, number> = {}) {
  let balance = opening;
  return Array.from({ length: 91 }, (_, day) => {
    balance -= debits[day] ?? 0;
    return { date: addDays(TODAY, day), balance };
  });
}

const invoice = (id: string, dueInDays: number, remaining: number, strategic = false): PlanInvoice => ({
  id,
  number: `F-${id}`,
  supplierId: `s-${id}`,
  supplierName: `Fournisseur ${id}`,
  strategic,
  legalDueDate: addDays(TODAY, dueInDays),
  amount: remaining,
  remaining,
});

const plan = (opening: number, invoices: PlanInvoice[], reserve = 0, debits: Record<number, number> = {}) =>
  buildPaymentPlan({ today: TODAY, balances: balances(opening, debits), invoices, reserve, params: PARAMS });

describe("buildPaymentPlan", () => {
  it("trésorerie suffisante : chèque cette semaine ou programmé avant la date limite", () => {
    const result = plan(100_000, [invoice("a", 3, 10_000), invoice("b", -10, 5_000), invoice("c", 40, 20_000), invoice("d", 120, 1_000)]);
    const byId = Object.fromEntries(result.items.map((item) => [item.id, item]));
    expect(byId.a).toMatchObject({ action: "check_now", date: TODAY, late: false, fine: 0 });
    // Déjà en retard : chèque aujourd'hui, amende du premier mois (2,25 %)
    expect(byId.b).toMatchObject({ action: "check_now", late: true, fine: 112.5 });
    expect(byId.c).toMatchObject({ action: "check_later", date: addDays(TODAY, 33) });
    expect(byId.d).toBeUndefined();
    expect(result.notUrgent).toBe(1);
    expect(result.totals).toEqual({ check_now: 15_000, check_later: 20_000, lcn: 0, defer: 0 });
    expect(result.lowAfter.balance).toBe(65_000);
  });

  it("la réserve n'est jamais entamée : le reste est à reporter, avec l'amende estimée", () => {
    // 30 000 disponibles, réserve 10 000 : 20 000 utilisables
    const result = plan(30_000, [invoice("a", 5, 15_000), invoice("b", 50, 12_000)], 10_000);
    const byId = Object.fromEntries(result.items.map((item) => [item.id, item]));
    expect(byId.a.action).toBe("check_now");
    // Reste 5 000 au-dessus de la réserve : ni chèque ni LCN pour 12 000 → à reporter
    expect(byId.b).toMatchObject({ action: "defer", late: true });
    expect(byId.b.fine).toBeGreaterThan(0);
    expect(result.lowAfter.balance).toBeGreaterThanOrEqual(10_000);
  });

  it("trésorerie qui remonte : LCN à 30 jours, avant la date limite", () => {
    // Solde qui remonte au 30e jour (encaissement attendu) ; date limite au 33e jour, chèque prévu au 26e impossible
    const days = balances(5_000).map((day, index) => ({ ...day, balance: index >= 30 ? 50_000 : 5_000 }));
    const result = buildPaymentPlan({ today: TODAY, balances: days, invoices: [invoice("a", 33, 30_000)], reserve: 0, params: PARAMS });
    expect(result.items[0]).toMatchObject({ action: "lcn", date: addDays(TODAY, 30), late: false, fine: 0 });
  });

  it("LCN seulement après la date limite : amende estimée", () => {
    const days = balances(1_000).map((day, index) => ({ ...day, balance: index >= 85 ? 50_000 : 1_000 }));
    const result = buildPaymentPlan({ today: TODAY, balances: days, invoices: [invoice("a", 20, 10_000)], reserve: 0, params: PARAMS });
    // Échéance à 90 jours, 70 jours après la date limite : 3 mois commencés → 2,25 + 2 × 0,85 = 3,95 %
    expect(result.items[0]).toMatchObject({ action: "lcn", date: addDays(TODAY, 90), late: true, fine: 395 });
    expect(result.fines).toBe(395);
  });

  it("fournisseur stratégique servi en premier quand la trésorerie manque", () => {
    const result = plan(12_000, [invoice("normal", 5, 10_000), invoice("strategique", 15, 10_000, true)]);
    const byId = Object.fromEntries(result.items.map((item) => [item.id, item]));
    expect(byId.strategique.action).toBe("check_later");
    expect(byId.normal.action).toBe("defer");
    expect(result.items[0].id).toBe("strategique");
  });

  it("débits déjà prévus pris en compte : un chèque aujourd'hui ne doit pas rendre une LCN existante impayable", () => {
    // 20 000 aujourd'hui, mais une LCN existante de 15 000 au jour 10
    const result = plan(20_000, [invoice("a", 2, 8_000)], 0, { 10: 15_000 });
    expect(result.items[0].action).toBe("defer");
    expect(result.lowBefore).toEqual({ date: addDays(TODAY, 10), balance: 5_000 });
  });
});
