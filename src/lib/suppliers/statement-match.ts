/**
 * Rapprochement avec le relevé de compte d'un fournisseur : chaque ligne de son relevé
 * (ses factures au débit, nos règlements au crédit) est comparée à nos factures et à nos
 * paiements. Fonctions pures, testées sans base.
 */
import { daysBetween } from "@/lib/dates";
import type { ParsedLine } from "@/lib/statements/parse";
import { extractInstrumentNumber, normalizeLabel } from "@/lib/statements/extract";

export type OurInvoice = { id: string; number: string; issueDate: string; amount: number };
export type OurPayment = { id: string; label: string; number: number | null; reference: string | null; date: string; amount: number; delivered: boolean };

export type MatchStatus = "matched" | "amount_diff" | "missing_ours" | "missing_theirs";
export type MatchRow = {
  kind: "invoice" | "payment";
  status: MatchStatus;
  /** Rapprochement d'après le montant et la date seulement (numéro non retrouvé). */
  probable: boolean;
  theirs: { date: string; label: string; reference: string | null; amount: number } | null;
  ours: { id: string; label: string; date: string; amount: number } | null;
  /** Montant du fournisseur − le nôtre. */
  difference: number;
};

export type SupplierComparison = {
  period: { start: string; end: string } | null;
  rows: MatchRow[];
  totals: { theirs: number; ours: number; difference: number };
  /** Lignes de solde ou de report écartées. */
  skipped: number;
};

const BALANCE_LABEL = /\b(?:SOLDE|REPORT|A NOUVEAU|ANCIEN SOLDE|TOTAL)\b/;
const INVOICE_WINDOW_DAYS = 5;
const PAYMENT_WINDOW_DAYS = 30;

const cents = (value: number) => Math.round(value * 100);
const sameAmount = (a: number, b: number) => cents(a) === cents(b);

/** Numéro de facture comparable : lettres et chiffres seulement, zéros initiaux retirés. */
export function invoiceKey(value: string): string {
  return normalizeLabel(value)
    .replace(/\d+/g, (digits) => digits.replace(/^0+(?=\d)/, ""))
    .replace(/[^A-Z0-9]/g, "");
}

export function compareSupplierStatement(
  lines: ParsedLine[],
  invoices: OurInvoice[],
  payments: OurPayment[],
  { swapSides = false }: { swapSides?: boolean } = {},
): SupplierComparison {
  const rows: MatchRow[] = [];
  const usedInvoices = new Set<string>();
  const usedPayments = new Set<string>();
  let skipped = 0;
  const movements = lines.filter((line) => {
    const isBalance = BALANCE_LABEL.test(normalizeLabel(line.label));
    skipped += isBalance ? 1 : 0;
    return !isBalance;
  });

  // Factures d'abord par numéro, puis paiements par numéro, puis les rapprochements « probables »
  const pending: { line: ParsedLine; kind: MatchRow["kind"]; amount: number }[] = movements.map((line) => {
    const debit = line.debit ?? 0;
    const credit = line.credit ?? 0;
    const invoiceSide = swapSides ? credit : debit;
    return invoiceSide > 0 ? { line, kind: "invoice", amount: invoiceSide } : { line, kind: "payment", amount: swapSides ? debit : credit };
  });
  const matches = new Map<(typeof pending)[number], { ours: MatchRow["ours"]; probable: boolean }>();

  for (const entry of pending) {
    if (entry.kind === "invoice") {
      const keys = [entry.line.reference, entry.line.label].filter(Boolean).map((text) => invoiceKey(text!));
      const invoice = invoices.find(
        (candidate) => !usedInvoices.has(candidate.id) && keys.some((key) => invoiceKeyMatches(key, invoiceKey(candidate.number))),
      );
      if (invoice) {
        usedInvoices.add(invoice.id);
        matches.set(entry, { ours: ourInvoice(invoice), probable: false });
      }
    } else {
      const extracted = extractInstrumentNumber(`${entry.line.reference ?? ""} ${entry.line.label}`);
      const reference = invoiceKey(entry.line.reference ?? "");
      const payment = payments.find(
        (candidate) =>
          !usedPayments.has(candidate.id) &&
          ((extracted !== null && candidate.number === extracted.number) ||
            (candidate.reference !== null && reference !== "" && invoiceKey(candidate.reference) === reference)),
      );
      if (payment) {
        usedPayments.add(payment.id);
        matches.set(entry, { ours: ourPayment(payment), probable: false });
      }
    }
  }
  for (const entry of pending) {
    if (matches.has(entry)) {
      continue;
    }
    if (entry.kind === "invoice") {
      const candidates = invoices.filter(
        (invoice) =>
          !usedInvoices.has(invoice.id) &&
          sameAmount(invoice.amount, entry.amount) &&
          Math.abs(daysBetween(invoice.issueDate, entry.line.operationDate)) <= INVOICE_WINDOW_DAYS,
      );
      if (candidates.length === 1) {
        usedInvoices.add(candidates[0].id);
        matches.set(entry, { ours: ourInvoice(candidates[0]), probable: true });
      }
    } else {
      const candidates = payments.filter(
        (payment) =>
          !usedPayments.has(payment.id) &&
          sameAmount(payment.amount, entry.amount) &&
          Math.abs(daysBetween(payment.date, entry.line.operationDate)) <= PAYMENT_WINDOW_DAYS,
      );
      if (candidates.length === 1) {
        usedPayments.add(candidates[0].id);
        matches.set(entry, { ours: ourPayment(candidates[0]), probable: true });
      }
    }
  }

  for (const entry of pending) {
    const match = matches.get(entry);
    const theirs = { date: entry.line.operationDate, label: entry.line.label, reference: entry.line.reference, amount: entry.amount };
    if (!match) {
      rows.push({ kind: entry.kind, status: "missing_ours", probable: false, theirs, ours: null, difference: entry.amount });
      continue;
    }
    const difference = (cents(entry.amount) - cents(match.ours!.amount)) / 100;
    rows.push({
      kind: entry.kind,
      status: difference === 0 ? "matched" : "amount_diff",
      probable: match.probable,
      theirs,
      ours: match.ours,
      difference,
    });
  }

  // Nos factures et paiements de la période absents du relevé
  const dates = movements.map((line) => line.operationDate).sort();
  const period = dates.length > 0 ? { start: dates[0], end: dates.at(-1)! } : null;
  if (period) {
    const inPeriod = (date: string) => date >= period.start && date <= period.end;
    for (const invoice of invoices.filter((candidate) => !usedInvoices.has(candidate.id) && inPeriod(candidate.issueDate))) {
      rows.push({ kind: "invoice", status: "missing_theirs", probable: false, theirs: null, ours: ourInvoice(invoice), difference: -invoice.amount });
    }
    for (const payment of payments.filter((candidate) => !usedPayments.has(candidate.id) && inPeriod(candidate.date))) {
      rows.push({ kind: "payment", status: "missing_theirs", probable: false, theirs: null, ours: ourPayment(payment), difference: -payment.amount });
    }
  }

  const balance = (row: MatchRow, side: "theirs" | "ours") => {
    const amount = row[side]?.amount ?? 0;
    return row.kind === "invoice" ? cents(amount) : -cents(amount);
  };
  const theirs = rows.reduce((sum, row) => sum + balance(row, "theirs"), 0) / 100;
  const ours = rows.reduce((sum, row) => sum + balance(row, "ours"), 0) / 100;
  rows.sort((a, b) => (a.theirs?.date ?? a.ours!.date).localeCompare(b.theirs?.date ?? b.ours!.date));
  return { period, rows, totals: { theirs, ours, difference: (cents(theirs) - cents(ours)) / 100 }, skipped };
}

/** Clé identique, ou numéro de facture contenu dans le libellé du fournisseur (« FACTURE F-12 DU 03/10 »). */
function invoiceKeyMatches(theirs: string, ours: string): boolean {
  if (ours.length < 2 || theirs === ours) {
    return ours.length >= 2;
  }
  if (ours.length < 4) {
    return false;
  }
  // « F20262 » n'est pas dans « F202621 » : le numéro trouvé ne se prolonge pas d'un chiffre
  for (let index = theirs.indexOf(ours); index >= 0; index = theirs.indexOf(ours, index + 1)) {
    if (!/\d/.test(ours.at(-1)!) || !/\d/.test(theirs[index + ours.length] ?? "")) {
      return true;
    }
  }
  return false;
}

function ourInvoice(invoice: OurInvoice): MatchRow["ours"] {
  return { id: invoice.id, label: `Facture ${invoice.number}`, date: invoice.issueDate, amount: invoice.amount };
}

function ourPayment(payment: OurPayment): MatchRow["ours"] {
  return { id: payment.id, label: payment.label, date: payment.date, amount: payment.amount };
}
