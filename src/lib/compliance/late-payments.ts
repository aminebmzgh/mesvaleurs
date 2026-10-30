/**
 * Loi 69-21 (délais de paiement, spec §10) : date de paiement retenue, mois de retard,
 * amende indicative, état trimestriel et rappel de déclaration. Fonctions pures :
 * les taux et délais viennent des paramètres légaux, jamais de constantes.
 */
import { addDays, daysBetween } from "@/lib/dates";

export type LegalParams = {
  /** Taux du premier mois (ou fraction) de retard, en %. */
  firstMonthRate: number;
  /** Taux par mois (ou fraction) supplémentaire, en %. */
  additionalMonthRate: number;
  /** Montant TTC en deçà duquel aucune amende n'est calculée (DH). */
  minInvoiceAmount: number;
  /** Déclaration au plus tard à la fin du N-ième mois après le trimestre. */
  declarationMonthsAfterQuarter: number;
  /** Chiffre d'affaires à partir duquel l'entreprise déclare (DH). */
  revenueThreshold: number;
};

/** « remittance » : remise du chèque, échéance de la LCN, date du virement ; « debit » : date de débit. */
export type PaymentDateBasis = "remittance" | "debit";

export type CompliancePayment = {
  type: "check" | "lcn" | "transfer" | "guarantee_check";
  status: string;
  /** Numéro de la formule (formaté) ou référence du virement. */
  reference: string | null;
  issueDate: string;
  deliveredAt: string | null;
  dueDate: string | null;
  debitedAt: string | null;
};

export type ComplianceInvoice = {
  id: string;
  number: string;
  issueDate: string;
  legalDueDate: string | null;
  amount: number;
  status: string;
  supplier: { name: string; ice: string | null };
  allocations: { amount: number; payment: CompliancePayment }[];
};

export type Quarter = { year: number; quarter: number };

/** Statuts d'un paiement qui règle la facture (comme « réglée » en base). */
const SETTLING = new Set(["issued", "delivered", "paid"]);

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Date retenue comme date de paiement, ou null si encore inconnue (débit attendu). */
export function paymentDate(payment: CompliancePayment, basis: PaymentDateBasis): string | null {
  if (basis === "debit") {
    return payment.debitedAt;
  }
  if (payment.type === "lcn") {
    return payment.dueDate ?? payment.issueDate;
  }
  if (payment.type === "transfer") {
    return payment.issueDate;
  }
  return payment.deliveredAt ?? payment.issueDate;
}

/** Ajoute des mois à une date, en restant au dernier jour du mois si besoin (31/01 + 1 → 28/02). */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Mois de retard, tout mois commencé comptant pour un mois ; 0 si payé dans le délai. */
export function monthsLate(dueDate: string, paidOn: string): number {
  if (paidOn <= dueDate) {
    return 0;
  }
  let months = 1;
  while (addMonths(dueDate, months) < paidOn) {
    months += 1;
  }
  return months;
}

/** Amende indicative pour un montant payé (ou resté impayé) avec ce retard. */
export function lateFine(amount: number, months: number, invoiceAmount: number, params: LegalParams): number {
  if (months <= 0 || invoiceAmount < params.minInvoiceAmount) {
    return 0;
  }
  const rate = params.firstMonthRate + params.additionalMonthRate * (months - 1);
  return round2((amount * rate) / 100);
}

export function quarterOf(date: string): Quarter {
  const [year, month] = date.split("-").map(Number);
  return { year, quarter: Math.ceil(month / 3) };
}

export function quarterRange({ year, quarter }: Quarter): { start: string; end: string } {
  const start = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`;
  return { start, end: addDays(addMonths(start, 3), -1) };
}

export function previousQuarter({ year, quarter }: Quarter): Quarter {
  return quarter === 1 ? { year: year - 1, quarter: 4 } : { year, quarter: quarter - 1 };
}

export const quarterLabel = ({ year, quarter }: Quarter) => `T${quarter} ${year}`;
export const quarterKey = ({ year, quarter }: Quarter) => `${year}-T${quarter}`;

export function parseQuarterKey(value: string | null | undefined): Quarter | null {
  const match = /^(\d{4})-T([1-4])$/.exec(value ?? "");
  return match ? { year: Number(match[1]), quarter: Number(match[2]) } : null;
}

/** Date limite de déclaration : dernier jour du N-ième mois qui suit le trimestre. */
export function declarationDeadline(quarter: Quarter, params: Pick<LegalParams, "declarationMonthsAfterQuarter">): string {
  const nextQuarterStart = addDays(quarterRange(quarter).end, 1);
  return addDays(addMonths(nextQuarterStart, params.declarationMonthsAfterQuarter), -1);
}

export type StatementRow = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  legalDueDate: string;
  supplier: string;
  ice: string | null;
  invoiceAmount: number;
  /** « late_paid » : payé hors délai pendant le trimestre ; « unpaid » : impayé et échu à la fin du trimestre. */
  kind: "late_paid" | "unpaid";
  amount: number;
  paymentType: CompliancePayment["type"] | null;
  paymentReference: string | null;
  paidOn: string | null;
  monthsLate: number;
  fine: number;
};

/**
 * État trimestriel : factures payées hors délai pendant le trimestre (une ligne par
 * paiement) et factures dont un reste est impayé et échu à la fin du trimestre.
 */
export function quarterStatement(
  invoices: ComplianceInvoice[],
  quarter: Quarter,
  basis: PaymentDateBasis,
  params: LegalParams,
): StatementRow[] {
  const { start, end } = quarterRange(quarter);
  const rows: StatementRow[] = [];
  for (const invoice of invoices) {
    const due = invoice.legalDueDate;
    if (!due || due >= end) {
      continue;
    }
    const base = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      invoiceDate: invoice.issueDate,
      legalDueDate: due,
      supplier: invoice.supplier.name,
      ice: invoice.supplier.ice,
      invoiceAmount: invoice.amount,
    };
    let paidByEnd = 0;
    for (const { amount, payment } of invoice.allocations) {
      if (!SETTLING.has(payment.status) || payment.type === "guarantee_check") {
        continue;
      }
      const paidOn = paymentDate(payment, basis);
      if (!paidOn || paidOn > end) {
        continue;
      }
      paidByEnd += amount;
      const months = monthsLate(due, paidOn);
      if (paidOn >= start && months > 0) {
        rows.push({
          ...base,
          kind: "late_paid",
          amount,
          paymentType: payment.type,
          paymentReference: payment.reference,
          paidOn,
          monthsLate: months,
          fine: lateFine(amount, months, invoice.amount, params),
        });
      }
    }
    const remaining = round2(invoice.amount - paidByEnd);
    if (remaining > 0.005) {
      const months = monthsLate(due, end);
      rows.push({
        ...base,
        kind: "unpaid",
        amount: remaining,
        paymentType: null,
        paymentReference: null,
        paidOn: null,
        monthsLate: months,
        fine: lateFine(remaining, months, invoice.amount, params),
      });
    }
  }
  return rows.sort((a, b) => a.legalDueDate.localeCompare(b.legalDueDate) || a.invoiceNumber.localeCompare(b.invoiceNumber));
}

export type ComplianceIndicators = {
  onTime: { count: number; amount: number };
  dueSoon: { count: number; amount: number };
  late: { count: number; amount: number };
};

/** Factures non soldées : dans les délais, proches de la date limite (sous N jours), en retard. */
export function complianceIndicators(invoices: ComplianceInvoice[], today: string, dueSoonDays: number, basis: PaymentDateBasis): ComplianceIndicators {
  const result: ComplianceIndicators = { onTime: { count: 0, amount: 0 }, dueSoon: { count: 0, amount: 0 }, late: { count: 0, amount: 0 } };
  for (const invoice of invoices) {
    if (!invoice.legalDueDate || invoice.status === "disputed") {
      continue;
    }
    const paid = invoice.allocations
      .filter(({ payment }) => SETTLING.has(payment.status) && payment.type !== "guarantee_check")
      .filter(({ payment }) => {
        const paidOn = paymentDate(payment, basis);
        return paidOn !== null && paidOn <= today;
      })
      .reduce((sum, { amount }) => sum + amount, 0);
    const remaining = round2(invoice.amount - paid);
    if (remaining <= 0.005) {
      continue;
    }
    const days = daysBetween(today, invoice.legalDueDate);
    const bucket = days < 0 ? result.late : days <= dueSoonDays ? result.dueSoon : result.onTime;
    bucket.count += 1;
    bucket.amount = round2(bucket.amount + remaining);
  }
  return result;
}

export type DeclarationReminder = { quarter: Quarter; deadline: string; daysLeft: number };

/**
 * Rappel de la déclaration du dernier trimestre écoulé, à partir de N jours avant la
 * date limite et tant qu'il n'est pas marqué « déclaré » (même après la date limite).
 */
export function declarationReminder(
  today: string,
  declared: Quarter[],
  reminderDays: number,
  params: Pick<LegalParams, "declarationMonthsAfterQuarter">,
): DeclarationReminder | null {
  const quarter = previousQuarter(quarterOf(today));
  if (declared.some((q) => q.year === quarter.year && q.quarter === quarter.quarter)) {
    return null;
  }
  const deadline = declarationDeadline(quarter, params);
  const daysLeft = daysBetween(today, deadline);
  return daysLeft <= reminderDays ? { quarter, deadline, daysLeft } : null;
}

/** L'entreprise est-elle tenue de déclarer ? Chiffre d'affaires inconnu : on le suppose. */
export function declarationRequired(annualRevenue: number | null, params: Pick<LegalParams, "revenueThreshold">): boolean {
  return annualRevenue === null || annualRevenue >= params.revenueThreshold;
}
