import { describe, expect, it } from "vitest";
import { type AlertSource, buildAlerts, countBySeverity } from "./alerts";

const empty: AlertSource = {
  pendingBatchCount: 0,
  insufficientAccounts: [],
  lcnDue: [],
  overdue: [],
  invoicesDue: { days: 7, invoices: [] },
  rejected: [],
  uncashed: { days: 60, count: 0, total: 0 },
  guaranteesToRecover: [],
  lowStock: [],
};

const lcn = (number: string, daysLeft: number, amount = 1000) => ({
  id: number,
  number,
  supplier: "Sotrama",
  amount,
  dueDate: `2026-11-${String(1 + Math.max(daysLeft, 0)).padStart(2, "0")}`,
  daysLeft,
});

describe("buildAlerts", () => {
  it("aucune alerte sans indicateur", () => {
    expect(buildAlerts(empty, { lcnAlertDays: 7 })).toEqual([]);
  });

  it("LCN : seulement celles qui échoient dans le délai réglé (échues comprises)", () => {
    const alerts = buildAlerts({ ...empty, lcnDue: [lcn("0000001", -2), lcn("0000002", 3, 2500.5), lcn("0000003", 12)] }, { lcnAlertDays: 7 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("lcn_due");
    expect(alerts[0].title).toBe("2 LCN à échoir sous 7 jours");
    expect(alerts[0].items.map((i) => i.badge)).toEqual(["échue depuis 2 j", "04/11/2026 · J-3"]);
    expect(alerts[0].items[0].overdue).toBe(true);
    expect(buildAlerts({ ...empty, lcnDue: [lcn("0000003", 12)] }, { lcnAlertDays: 15 })).toHaveLength(1);
  });

  it("tri par gravité : rejets et provision d'abord, informations à la fin", () => {
    const alerts = buildAlerts(
      {
        ...empty,
        pendingBatchCount: 2,
        uncashed: { days: 60, count: 1, total: 500 },
        lcnDue: [lcn("0000001", 1)],
        insufficientAccounts: [{ id: "a", label: "BMCE principal", current_balance: 1000, circulation: 1500, projected: -500 }],
        rejected: [
          {
            id: "r",
            label: "Chèque 0001005",
            supplier: "Atlas",
            amount: 800,
            kind: "insufficient_funds",
            state: { kind: "pending", dueDate: "2026-11-28", daysLeft: 30 },
          },
        ],
      },
      { lcnAlertDays: 7 },
    );
    expect(alerts.map((a) => a.kind)).toEqual(["rejected", "insufficient_funds", "lcn_due", "uncashed", "pending_batches"]);
    expect(alerts[0].items[0].badge).toBe("J-30 · 28/11/2026");
    expect(alerts[4].title).toBe("2 lots à valider avant impression");
    expect(countBySeverity(alerts)).toEqual({ critical: 2, warning: 1, info: 2 });
  });

  it("factures proches de la date limite légale et en retard", () => {
    const alerts = buildAlerts(
      {
        ...empty,
        overdue: [{ id: "i1", number: "F-001", supplier: "Sotrama", remaining: 1200, daysLate: 4 }],
        invoicesDue: {
          days: 7,
          invoices: [
            { id: "i2", number: "F-002", supplier: "Atlas", remaining: 300.1, legalDueDate: "2026-10-29", daysLeft: 0 },
            { id: "i3", number: "F-003", supplier: "Atlas", remaining: 199.9, legalDueDate: "2026-11-02", daysLeft: 4 },
          ],
        },
      },
      { lcnAlertDays: 7 },
    );
    expect(alerts.map((a) => a.title)).toEqual(["1 facture en retard", "2 factures à payer sous 7 jours"]);
    expect(alerts[1].detail).toContain("500,00");
    expect(alerts[1].items.map((i) => i.badge)).toEqual(["aujourd'hui", "02/11/2026 · J-4"]);
  });

  it("carnet presque épuisé : un par compte et type", () => {
    const [alert] = buildAlerts({ ...empty, lowStock: [{ id: "x", bankAccountId: "b1", type: "lcn", remaining: 1, account: "CIH" }] }, { lcnAlertDays: 7 });
    expect(alert.title).toBe("Carnet de LCN presque épuisé : CIH");
    expect(alert.detail).toMatch(/^1 formule restante\./);
    expect(alert.href).toBe("/comptes-bancaires/b1");
  });
});

describe("déclaration trimestrielle (loi 69-21)", () => {
  it("à déposer : avertissement ; en retard : urgent, lien vers l'état du trimestre", () => {
    const [due] = buildAlerts(empty, { lcnAlertDays: 7, declaration: { quarter: { year: 2026, quarter: 3 }, deadline: "2026-10-31", daysLeft: 5 } });
    expect(due).toMatchObject({
      kind: "declaration_due",
      severity: "warning",
      title: "Déclaration des délais de paiement du T3 2026 à déposer",
      href: "/conformite?trimestre=2026-T3",
    });
    expect(due.detail).toContain("Avant le 31/10/2026 (J-5)");
    const [late] = buildAlerts(empty, { lcnAlertDays: 7, declaration: { quarter: { year: 2026, quarter: 3 }, deadline: "2026-10-31", daysLeft: -2 } });
    expect(late).toMatchObject({ severity: "critical", title: "Déclaration des délais de paiement du T3 2026 en retard" });
  });
});
