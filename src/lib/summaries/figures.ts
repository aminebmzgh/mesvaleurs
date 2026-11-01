import { type LegalParams, lateFine, monthsLate } from "@/lib/compliance/late-payments";
import { addDays } from "@/lib/dates";

/**
 * Résumé mensuel (spec §11 bis L) : ce qui a été payé le mois écoulé, ce qui reste à payer,
 * les risques. Calcul pur à partir des paiements, factures et soldes de l'entreprise.
 */

/** Horizon des échéances à venir signalées (jours). */
export const SUMMARY_HORIZON_DAYS = 30;
/** Factures en retard détaillées dans l'e-mail, au plus. */
export const LATE_LISTED = 5;

export type SummaryPayment = {
  type: "check" | "lcn" | "transfer" | "guarantee_check";
  status: string;
  amount: number;
  issueDate: string;
  dueDate: string | null;
  debitedAt: string | null;
  regularizedAt: string | null;
};
export type SummaryInvoice = { number: string; supplier: string; legalDueDate: string | null; amountInclTax: number; amountPaid: number; status: string };

export type Bucket = { count: number; total: number };

export type MonthlySummary = {
  /** Premier et dernier jour du mois résumé. */
  month: { start: string; end: string };
  paid: Bucket & { checks: Bucket; lcns: Bucket; transfers: Bucket };
  issued: Bucket;
  remaining: { invoices: Bucket; inCirculation: Bucket };
  risks: {
    late: Bucket & { fines: number; listed: { number: string; supplier: string; remaining: number; legalDueDate: string }[] };
    dueSoon: Bucket;
    lcnDueSoon: Bucket;
    rejected: Bucket;
    /** Soldes bancaires moins les engagements des 30 prochains jours (circulation + factures à échéance). */
    coverage: { balance: number; commitments: number; gap: number };
  };
};

const cents = (value: number) => Math.round(value * 100);
const add = (bucket: Bucket, amount: number) => {
  bucket.count += 1;
  bucket.total = (cents(bucket.total) + cents(amount)) / 100;
};
const empty = (): Bucket => ({ count: 0, total: 0 });

/** Mois civil précédant la date (résumé envoyé le 1er du mois suivant). */
export function previousMonth(today: string): { start: string; end: string } {
  const [year, month] = today.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 2, 1));
  const end = new Date(Date.UTC(year, month - 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function computeMonthlySummary({
  month,
  today,
  payments,
  invoices,
  balance,
  params,
}: {
  month: { start: string; end: string };
  today: string;
  payments: SummaryPayment[];
  invoices: SummaryInvoice[];
  balance: number;
  params: LegalParams;
}): MonthlySummary {
  const horizon = addDays(today, SUMMARY_HORIZON_DAYS);
  const inMonth = (date: string | null) => date !== null && date >= month.start && date <= month.end;
  const summary: MonthlySummary = {
    month,
    paid: { ...empty(), checks: empty(), lcns: empty(), transfers: empty() },
    issued: empty(),
    remaining: { invoices: empty(), inCirculation: empty() },
    risks: { late: { ...empty(), fines: 0, listed: [] }, dueSoon: empty(), lcnDueSoon: empty(), rejected: empty(), coverage: { balance, commitments: 0, gap: 0 } },
  };

  for (const payment of payments) {
    // Un chèque de garantie n'est pas un règlement
    if (payment.type === "guarantee_check") {
      continue;
    }
    if (payment.status === "paid" && inMonth(payment.debitedAt)) {
      add(summary.paid, payment.amount);
      add(payment.type === "lcn" ? summary.paid.lcns : payment.type === "transfer" ? summary.paid.transfers : summary.paid.checks, payment.amount);
    }
    if (inMonth(payment.issueDate) && !["draft", "cancelled"].includes(payment.status)) {
      add(summary.issued, payment.amount);
    }
    if (payment.status === "issued" || payment.status === "delivered") {
      add(summary.remaining.inCirculation, payment.amount);
      if (payment.type === "lcn" && payment.dueDate && payment.dueDate <= horizon) {
        add(summary.risks.lcnDueSoon, payment.amount);
      }
    }
    if (payment.status === "rejected" && !payment.regularizedAt) {
      add(summary.risks.rejected, payment.amount);
    }
  }

  const late: MonthlySummary["risks"]["late"]["listed"] = [];
  for (const invoice of invoices) {
    const remaining = Math.max(cents(invoice.amountInclTax) - cents(invoice.amountPaid), 0) / 100;
    if (remaining <= 0 || invoice.status === "disputed" || invoice.status === "paid") {
      continue;
    }
    add(summary.remaining.invoices, remaining);
    if (!invoice.legalDueDate) {
      continue;
    }
    if (invoice.legalDueDate < today) {
      add(summary.risks.late, remaining);
      summary.risks.late.fines =
        (cents(summary.risks.late.fines) + cents(lateFine(remaining, monthsLate(invoice.legalDueDate, today), invoice.amountInclTax, params))) / 100;
      late.push({ number: invoice.number, supplier: invoice.supplier, remaining, legalDueDate: invoice.legalDueDate });
    } else if (invoice.legalDueDate <= horizon) {
      add(summary.risks.dueSoon, remaining);
    }
  }
  summary.risks.late.listed = late
    .sort((a, b) => a.legalDueDate.localeCompare(b.legalDueDate) || b.remaining - a.remaining)
    .slice(0, LATE_LISTED);

  const commitments = (cents(summary.remaining.inCirculation.total) + cents(summary.risks.late.total) + cents(summary.risks.dueSoon.total)) / 100;
  summary.risks.coverage = { balance, commitments, gap: (cents(balance) - cents(commitments)) / 100 };
  return summary;
}
