/**
 * Portail fournisseur (#48) : ce que voit le fournisseur sur son lien secret, et les
 * libellés de suivi écrits pour lui (et non pour l'entreprise qui paie).
 */
import type { Database } from "@/types/database";

type PaymentType = Database["public"]["Enums"]["payment_type"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export type PortalPayment = {
  id: string;
  type: PaymentType;
  status: PaymentStatus;
  number: number | null;
  reference: string | null;
  amount: number;
  issueDate: string;
  dueDate: string | null;
  deliveredAt: string | null;
  debitedAt: string | null;
  rejectedAt: string | null;
  regularizedAt: string | null;
  bank: string | null;
  invoices: { number: string; amount: number }[];
};

export type PortalOpenInvoice = {
  number: string;
  issueDate: string;
  dueDate: string | null;
  amountInclTax: number;
  amountPaid: number;
  disputed: boolean;
};

export type PortalData = {
  organization: { name: string; city: string | null; phone: string | null; email: string | null };
  supplier: { name: string };
  payments: PortalPayment[];
  openInvoices: PortalOpenInvoice[];
  generatedAt: string;
};

/** Jeton d'un lien de portail : 32 caractères base64url (cf. migration du portail). */
export const PORTAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function portalUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/suivi/${token}`;
}

export type PortalTone = "pending" | "progress" | "done" | "problem";

/** Étape du règlement vue par le fournisseur, avec la date qui l'explique. */
export function portalStatus(payment: Pick<PortalPayment, "type" | "status" | "deliveredAt" | "debitedAt" | "rejectedAt" | "regularizedAt">): {
  label: string;
  tone: PortalTone;
  date: string | null;
} {
  if (payment.type === "transfer") {
    return payment.status === "paid"
      ? { label: "Virement exécuté", tone: "done", date: payment.debitedAt }
      : { label: "Virement ordonné", tone: "progress", date: null };
  }
  switch (payment.status) {
    case "issued":
      return { label: "Prêt, à remettre", tone: "pending", date: null };
    case "delivered":
      return { label: "Remis, à encaisser", tone: "progress", date: payment.deliveredAt };
    case "paid":
      return { label: "Encaissé", tone: "done", date: payment.debitedAt };
    case "rejected":
      return payment.regularizedAt
        ? { label: "Rejeté, régularisé", tone: "done", date: payment.regularizedAt }
        : { label: "Rejeté", tone: "problem", date: payment.rejectedAt };
    default:
      return { label: "—", tone: "pending", date: null };
  }
}

export const PORTAL_TYPE_LABELS: Record<PaymentType, string> = {
  check: "Chèque",
  lcn: "LCN",
  guarantee_check: "Chèque de garantie",
  transfer: "Virement",
};

/** Totaux affichés en tête : à remettre, remis non encaissés, encaissés, reste dû sur les factures ouvertes. */
export function portalTotals(data: Pick<PortalData, "payments" | "openInvoices">) {
  const cents = (n: number) => Math.round(n * 100);
  let pending = 0;
  let inProgress = 0;
  let done = 0;
  for (const payment of data.payments) {
    const tone = portalStatus(payment).tone;
    if (tone === "pending") pending += cents(payment.amount);
    else if (tone === "progress") inProgress += cents(payment.amount);
    else if (tone === "done") done += cents(payment.amount);
  }
  const outstanding = data.openInvoices.reduce((sum, invoice) => sum + Math.max(cents(invoice.amountInclTax) - cents(invoice.amountPaid), 0), 0);
  return { pending: pending / 100, inProgress: inProgress / 100, done: done / 100, outstanding: outstanding / 100 };
}
