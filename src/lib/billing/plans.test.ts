import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aiQuotaFor, effectivePlan, FEATURES, hasFeature, PLAN_IDS, PLANS, trialDaysLeft, upgradeMessage } from "./plans";

/** Dernière définition de private.plan_limits dans les migrations. */
function sqlPlanLimits() {
  const dir = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .reverse()
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .find((sql) => sql.includes("function private.plan_limits("));
  const rows = [...(file ?? "").matchAll(/\('(\w+)', '([^']+)', (\w+), (\w+), (\w+), (\w+)\)/g)];
  const value = (raw: string) => (raw === "null" ? null : Number(raw));
  return Object.fromEntries(
    rows.map(([, plan, label, accounts, members, payments, approvals]) => [
      plan,
      { label, maxBankAccounts: value(accounts), maxMembers: value(members), maxMonthlyPayments: value(payments), approvals: approvals === "true" },
    ]),
  );
}

describe("offres", () => {
  it("limites identiques en base et dans l'application", () => {
    const sql = sqlPlanLimits();
    expect(Object.keys(sql).sort()).toEqual([...PLAN_IDS].sort());
    for (const id of PLAN_IDS) {
      const plan = PLANS[id];
      expect(sql[id]).toEqual({
        label: plan.label,
        maxBankAccounts: plan.maxBankAccounts,
        maxMembers: plan.maxMembers,
        maxMonthlyPayments: plan.maxMonthlyPayments,
        approvals: hasFeature(id, "approvals"),
      });
    }
  });

  it("grille validée : limites et prix", () => {
    expect([PLANS.free.maxBankAccounts, PLANS.free.maxMembers, PLANS.free.maxMonthlyPayments]).toEqual([1, 1, 10]);
    expect([PLANS.pro.maxBankAccounts, PLANS.pro.maxMembers, PLANS.pro.monthlyPrice]).toEqual([2, 3, 290]);
    expect(PLANS.cabinet).toMatchObject({ monthlyPrice: 1490, includedClients: 15, extraClientPrice: 80 });
  });

  it("chaque offre comprend celles de rang inférieur", () => {
    for (const key of Object.keys(FEATURES) as (keyof typeof FEATURES)[]) {
      const available = PLAN_IDS.map((id) => hasFeature(id, key));
      expect(available).toEqual([...available].sort());
    }
    expect(hasFeature("free", "statistics")).toBe(false);
    expect(hasFeature("pro", "statistics")).toBe(true);
    expect(hasFeature("pro", "audit_journal")).toBe(false);
    expect(hasFeature("business", "consolidated")).toBe(false);
    expect(hasFeature("cabinet", "consolidated")).toBe(true);
  });

  it("offre en vigueur : Business pendant l'essai, puis l'offre souscrite", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    expect(effectivePlan({ plan: "free", trial_ends_at: "2026-11-10T00:00:00Z" }, now)).toBe("business");
    expect(effectivePlan({ plan: "pro", trial_ends_at: "2026-11-01T00:00:00Z" }, now)).toBe("pro");
    expect(effectivePlan({ plan: "inconnue", trial_ends_at: null }, now)).toBe("free");
    expect(effectivePlan(null, now)).toBe("free");
    expect(trialDaysLeft("2026-11-07T00:00:00Z", now)).toBe(1);
    expect(trialDaysLeft("2026-11-20T12:00:00Z", now)).toBe(14);
    expect(trialDaysLeft("2026-11-01T00:00:00Z", now)).toBeNull();
  });

  it("quota d'IA plafonné par l'offre ; message de changement d'offre", () => {
    expect(aiQuotaFor("pro", 500)).toBe(100);
    expect(aiQuotaFor("business", 200)).toBe(200);
    expect(aiQuotaFor("free", 100)).toBe(0);
    expect(upgradeMessage("forecast")).toBe("Prévision de trésorerie : fonctionnalité de l'offre Pro. Changez d'offre depuis Paramètres › Abonnement.");
  });
});
