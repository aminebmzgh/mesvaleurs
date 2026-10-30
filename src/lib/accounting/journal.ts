/**
 * Export comptable mensuel (spec §11.2) : journal des règlements fournisseurs, deux lignes
 * par opération (débit / crédit), au format paramétré par l'entreprise.
 */

import type { AccountingExportSettings } from "@/lib/organizations/settings";

export type JournalPayment = {
  type: "check" | "lcn" | "transfer" | "guarantee_check";
  /** Numéro de formule ou référence du virement. */
  piece: string;
  /** « Chèque 0001003 », « LCN 5000101 »… */
  label: string;
  amount: number;
  issueDate: string;
  debitedAt: string | null;
  supplier: { name: string; accountingCode: string | null };
  bankAccountCode: string | null;
  invoices: string[];
};

export type JournalLine = {
  date: string;
  journal: string;
  account: string;
  auxiliary: string;
  piece: string;
  label: string;
  debit: number;
  credit: number;
};

const inMonth = (date: string | null, month: string): date is string => date !== null && date.slice(0, 7) === month;

/**
 * Écritures du mois « AAAA-MM ».
 * - Base « débit » : chaque règlement débité dans le mois — fournisseur au débit, banque au crédit.
 * - Base « émission » : chèques et virements émis dans le mois (fournisseur / banque) ; LCN
 *   émises (fournisseur / effets à payer), puis débitées (effets à payer / banque) ; chèques
 *   de garantie seulement s'ils sont encaissés (fournisseur / banque).
 */
export function journalEntries(payments: JournalPayment[], month: string, settings: AccountingExportSettings): JournalLine[] {
  const lines: JournalLine[] = [];
  const entry = (payment: JournalPayment, date: string, debit: [string, string], credit: [string, string], prefix = "Règlement") => {
    const label = `${prefix} ${payment.supplier.name} — ${payment.label}${payment.invoices.length > 0 ? ` — ${payment.invoices.join(", ")}` : ""}`;
    const base = { date, journal: settings.journal, piece: payment.piece, label };
    lines.push({ ...base, account: debit[0], auxiliary: debit[1], debit: payment.amount, credit: 0 });
    lines.push({ ...base, account: credit[0], auxiliary: credit[1], debit: 0, credit: payment.amount });
  };

  for (const payment of payments) {
    const supplier: [string, string] = [settings.supplierAccount, payment.supplier.accountingCode ?? ""];
    const bank: [string, string] = [payment.bankAccountCode ?? settings.bankAccount, ""];
    const bills: [string, string] = [settings.billsAccount, payment.supplier.accountingCode ?? ""];

    if (settings.basis === "debit" || payment.type === "guarantee_check") {
      if (inMonth(payment.debitedAt, month)) {
        entry(payment, payment.debitedAt, supplier, bank);
      }
      continue;
    }
    if (payment.type === "lcn") {
      if (inMonth(payment.issueDate, month)) {
        entry(payment, payment.issueDate, supplier, bills);
      }
      if (inMonth(payment.debitedAt, month)) {
        entry(payment, payment.debitedAt, bills, bank, "Échéance LCN");
      }
    } else if (inMonth(payment.issueDate, month)) {
      entry(payment, payment.issueDate, supplier, bank);
    }
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date) || a.piece.localeCompare(b.piece) || b.debit - a.debit);
}

function formatDate(date: string, format: AccountingExportSettings["dateFormat"]): string {
  const [year, month, day] = date.split("-");
  if (format === "yyyy-mm-dd") {
    return date;
  }
  return format === "ddmmyy" ? `${day}${month}${year.slice(2)}` : `${day}/${month}/${year}`;
}

/** Fichier du journal : séparateur, format de date et séparateur décimal paramétrés, BOM UTF-8. */
export function journalCsv(lines: JournalLine[], settings: AccountingExportSettings): string {
  const separator = settings.separator === "tab" ? "\t" : settings.separator;
  const escape = (text: string) => (text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text);
  const amount = (value: number) => (value === 0 ? "" : value.toFixed(2).replace(".", settings.decimal));
  const rows = lines.map((line) =>
    [formatDate(line.date, settings.dateFormat), line.journal, line.account, line.auxiliary, line.piece, line.label, amount(line.debit), amount(line.credit)]
      .map((value) => escape(value))
      .join(separator),
  );
  const header = ["Date", "Journal", "Compte", "Compte auxiliaire", "Pièce", "Libellé", "Débit", "Crédit"].join(separator);
  return `\uFEFF${[...(settings.header ? [header] : []), ...rows].join("\r\n")}\r\n`;
}

/** Totaux de contrôle : un journal équilibré a autant au débit qu'au crédit. */
export function journalTotals(lines: JournalLine[]): { debit: number; credit: number } {
  const sum = (key: "debit" | "credit") => lines.reduce((total, line) => total + Math.round(line[key] * 100), 0) / 100;
  return { debit: sum("debit"), credit: sum("credit") };
}
