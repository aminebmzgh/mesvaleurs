/** Tableaux d'export des listes : chèques et LCN, factures, fournisseurs. */

import { INVOICE_STATUS_LABELS, type InvoiceStatus, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, type PaymentStatus, type PaymentType } from "@/lib/labels";
import { paymentNumber } from "@/lib/payments/label";
import type { ExportTable } from "./table";

type PaymentRow = {
  type: PaymentType;
  status: PaymentStatus;
  number: number | null;
  reference?: string | null;
  amount: number;
  payee_name: string;
  issue_date: string;
  due_date: string | null;
  delivered_at: string | null;
  debited_at: string | null;
  cancellation_reason: string | null;
  suppliers: { name: string } | null;
  bank_accounts: { label: string } | null;
  checkbooks: { number_width: number } | null;
};

export function paymentsTable(rows: PaymentRow[], subtitle: string): ExportTable {
  return {
    title: "Chèques et LCN",
    subtitle,
    columns: [
      { header: "Type", kind: "text", width: 14 },
      { header: "Numéro", kind: "text", width: 14 },
      { header: "Fournisseur", kind: "text", width: 28 },
      { header: "Bénéficiaire", kind: "text", width: 28 },
      { header: "Compte", kind: "text", width: 18 },
      { header: "Émis le", kind: "date", width: 11 },
      { header: "Échéance", kind: "date", width: 11 },
      { header: "Remis le", kind: "date", width: 11 },
      { header: "Débité le", kind: "date", width: 11 },
      { header: "Montant", kind: "amount", width: 14 },
      { header: "Statut", kind: "text", width: 14 },
      { header: "Motif d'annulation", kind: "text", width: 28 },
    ],
    rows: rows.map((p) => [
      PAYMENT_TYPE_LABELS[p.type],
      paymentNumber(p),
      p.suppliers?.name ?? "",
      p.payee_name,
      p.bank_accounts?.label ?? "",
      p.issue_date,
      p.due_date,
      p.delivered_at,
      p.debited_at,
      p.amount,
      PAYMENT_STATUS_LABELS[p.status],
      p.cancellation_reason,
    ]),
  };
}

type InvoiceRow = {
  number: string;
  issue_date: string;
  legal_due_date: string | null;
  amount_incl_tax: number;
  amount_paid: number;
  amount_cashed: number;
  status: InvoiceStatus;
  suppliers: { name: string } | null;
};

export function invoicesTable(rows: InvoiceRow[], subtitle: string): ExportTable {
  return {
    title: "Factures",
    subtitle,
    columns: [
      { header: "Numéro", kind: "text", width: 18 },
      { header: "Fournisseur", kind: "text", width: 30 },
      { header: "Date", kind: "date", width: 11 },
      { header: "Date limite légale", kind: "date", width: 14 },
      { header: "Montant TTC", kind: "amount", width: 14 },
      { header: "Réglé", kind: "amount", width: 14 },
      { header: "Encaissé", kind: "amount", width: 14 },
      { header: "Reste dû", kind: "amount", width: 14 },
      { header: "Statut", kind: "text", width: 18 },
    ],
    rows: rows.map((i) => [
      i.number,
      i.suppliers?.name ?? "",
      i.issue_date,
      i.legal_due_date,
      i.amount_incl_tax,
      i.amount_paid,
      i.amount_cashed,
      Math.round((i.amount_incl_tax - i.amount_paid) * 100) / 100,
      INVOICE_STATUS_LABELS[i.status],
    ]),
  };
}

type SupplierRow = {
  name: string;
  city: string | null;
  ice: string | null;
  payment_terms_days: number | null;
  is_active: boolean;
  summary?: { open_invoice_count: number | null; amount_due: number | null; amount_in_circulation: number | null } | null;
};

export function suppliersTable(rows: SupplierRow[], subtitle: string): ExportTable {
  return {
    title: "Fournisseurs",
    subtitle,
    columns: [
      { header: "Raison sociale", kind: "text", width: 32 },
      { header: "Ville", kind: "text", width: 16 },
      { header: "ICE", kind: "text", width: 18 },
      { header: "Délai convenu (jours)", kind: "integer", width: 12 },
      { header: "Factures ouvertes", kind: "integer", width: 12 },
      { header: "Reste à payer", kind: "amount", width: 16 },
      { header: "En circulation", kind: "amount", width: 16 },
      { header: "Actif", kind: "text", width: 8 },
    ],
    rows: rows.map((s) => [
      s.name,
      s.city,
      s.ice,
      s.payment_terms_days,
      s.summary?.open_invoice_count ?? 0,
      s.summary?.amount_due ?? 0,
      s.summary?.amount_in_circulation ?? 0,
      s.is_active ? "Oui" : "Non",
    ]),
  };
}
