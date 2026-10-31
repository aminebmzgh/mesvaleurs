/**
 * Optimiseur de paiements (spec §11 bis J) : plan de paiement des factures en attente,
 * d'après la trésorerie prévisionnelle, les dates limites légales (loi 69-21), l'amende
 * encourue et les fournisseurs stratégiques. Fonction pure, en centimes.
 *
 * Méthode : les factures sont servies par ordre d'urgence (date limite légale, avancée
 * pour les fournisseurs stratégiques). Chacune est réglée par chèque si le solde
 * prévisionnel le permet sans passer sous la réserve, sinon par une LCN à 30, 60 ou 90
 * jours (de préférence avant la date limite), sinon elle est à reporter.
 */
import { lateFine, type LegalParams, monthsLate } from "@/lib/compliance/late-payments";
import { addDays, daysBetween } from "@/lib/dates";

export const PLAN_SETTINGS = {
  /** Factures dont la date limite tombe dans ce délai : chèque cette semaine. */
  weekDays: 7,
  /** Factures prises en compte : date limite dépassée ou dans ce délai. */
  horizonDays: 60,
  /** Chèque programmé : émis une semaine avant la date limite. */
  leadDays: 7,
  /** Fournisseurs stratégiques : servis comme si leur date limite tombait 15 jours plus tôt. */
  strategicLeadDays: 15,
  lcnTerms: [30, 60, 90] as const,
};

export type PlanInvoice = {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  strategic: boolean;
  legalDueDate: string;
  /** Montant TTC (seuil de l'amende). */
  amount: number;
  /** Reste à payer. */
  remaining: number;
};

export type PlanAction = "check_now" | "check_later" | "lcn" | "defer";

export type PlanItem = PlanInvoice & {
  action: PlanAction;
  /** Chèque : date d'émission ; LCN : échéance ; à reporter : date limite. */
  date: string;
  /** Payée (ou à payer) après la date limite légale. */
  late: boolean;
  /** Amende indicative au paiement proposé (à reporter : à l'horizon de la prévision). */
  fine: number;
};

export type PaymentPlan = {
  items: PlanItem[];
  /** Factures ouvertes hors du plan (date limite lointaine). */
  notUrgent: number;
  reserve: number;
  /** Solde prévisionnel le plus bas, sans puis avec le plan. */
  lowBefore: { date: string; balance: number };
  lowAfter: { date: string; balance: number };
  totals: Record<PlanAction, number>;
  fines: number;
};

const cents = (amount: number) => Math.round(amount * 100);

export function buildPaymentPlan({
  today,
  balances,
  invoices,
  reserve,
  params,
}: {
  today: string;
  /** Solde prévisionnel de chaque jour, d'aujourd'hui à l'horizon de la prévision (engagements actuels). */
  balances: { date: string; balance: number }[];
  invoices: PlanInvoice[];
  reserve: number;
  params: LegalParams;
}): PaymentPlan {
  const days = balances.map((day) => day.date);
  const level = balances.map((day) => cents(day.balance));
  const reserveCents = cents(reserve);
  const lastDate = days.at(-1) ?? today;

  /** Le solde reste-t-il au-dessus de la réserve après un débit de `amount` au jour `index` ? */
  const fits = (index: number, amount: number) => {
    if (index < 0 || index >= level.length) {
      return false;
    }
    let low = Infinity;
    for (let i = index; i < level.length; i += 1) {
      low = Math.min(low, level[i]);
    }
    return low - amount >= reserveCents;
  };
  const debit = (index: number, amount: number) => {
    for (let i = index; i < level.length; i += 1) {
      level[i] -= amount;
    }
  };
  const lowest = (values: number[]) => {
    const index = values.reduce((best, value, i) => (value < values[best] ? i : best), 0);
    return { date: days[index] ?? today, balance: (values[index] ?? 0) / 100 };
  };
  const lowBefore = lowest(level);

  const horizon = addDays(today, PLAN_SETTINGS.horizonDays);
  const planned = invoices.filter((invoice) => invoice.remaining > 0 && invoice.legalDueDate <= horizon);
  const urgency = (invoice: PlanInvoice) => (invoice.strategic ? addDays(invoice.legalDueDate, -PLAN_SETTINGS.strategicLeadDays) : invoice.legalDueDate);
  planned.sort((a, b) => urgency(a).localeCompare(urgency(b)) || a.remaining - b.remaining);

  const fineAt = (invoice: PlanInvoice, paidOn: string) => lateFine(invoice.remaining, monthsLate(invoice.legalDueDate, paidOn), invoice.amount, params);
  const items: PlanItem[] = planned.map((invoice) => {
    const amount = cents(invoice.remaining);
    const soon = invoice.legalDueDate <= addDays(today, PLAN_SETTINGS.weekDays);
    const checkDate = soon ? today : addDays(invoice.legalDueDate, -PLAN_SETTINGS.leadDays);
    const checkIndex = daysBetween(today, checkDate);
    if (fits(checkIndex, amount)) {
      debit(checkIndex, amount);
      return {
        ...invoice,
        action: soon ? "check_now" : "check_later",
        date: checkDate,
        late: checkDate > invoice.legalDueDate,
        fine: fineAt(invoice, checkDate),
      };
    }
    // LCN : la première échéance possible avant la date limite, sinon la première possible
    const terms = PLAN_SETTINGS.lcnTerms.map((term) => addDays(today, term)).filter((due) => fits(daysBetween(today, due), amount));
    const due = terms.find((date) => date <= invoice.legalDueDate) ?? terms[0];
    if (due) {
      debit(daysBetween(today, due), amount);
      return { ...invoice, action: "lcn", date: due, late: due > invoice.legalDueDate, fine: fineAt(invoice, due) };
    }
    return { ...invoice, action: "defer", date: invoice.legalDueDate, late: true, fine: fineAt(invoice, lastDate) };
  });

  const totals: Record<PlanAction, number> = { check_now: 0, check_later: 0, lcn: 0, defer: 0 };
  for (const item of items) {
    totals[item.action] = (cents(totals[item.action]) + cents(item.remaining)) / 100;
  }
  return {
    items,
    notUrgent: invoices.filter((invoice) => invoice.remaining > 0 && invoice.legalDueDate > horizon).length,
    reserve,
    lowBefore,
    lowAfter: lowest(level),
    totals,
    fines: items.reduce((sum, item) => sum + cents(item.fine), 0) / 100,
  };
}
