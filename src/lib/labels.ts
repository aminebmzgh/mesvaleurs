import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];
export type InvoiceStatus = Enums["invoice_status"];
export type PaymentStatus = Enums["payment_status"];
export type PaymentType = Enums["payment_type"];
export type RejectionKind = Enums["rejection_kind"];
export type RegularizationMethod = Enums["regularization_method"];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Non payée",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  disputed: "Contestée",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  check: "Chèque",
  lcn: "LCN",
  guarantee_check: "Chèque de garantie",
  transfer: "Virement",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: "Brouillon",
  issued: "Émis",
  delivered: "Remis",
  paid: "Débité",
  rejected: "Rejeté",
  cancelled: "Annulé",
  lost: "Perdu",
  stopped: "En opposition",
};

export const REJECTION_KIND_LABELS: Record<RejectionKind, string> = {
  insufficient_funds: "Provision insuffisante",
  signature: "Signature non conforme",
  stop_order: "Opposition",
  irregularity: "Irrégularité de la formule",
  other: "Autre motif",
};

export const REGULARIZATION_METHOD_LABELS: Record<RegularizationMethod, string> = {
  new_provision: "Nouvelle provision (chèque représenté)",
  replacement: "Chèque ou LCN de remplacement",
  transfer: "Virement",
  other: "Autre moyen",
};

/** Mention affichée avec les délais légaux calculés par l'application. */
export const LEGAL_DISCLAIMER = "Informations indicatives, ne constituent pas un conseil juridique.";

/** Variante de badge selon la gravité du statut. */
export function paymentStatusVariant(status: PaymentStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "paid":
      return "default";
    case "issued":
    case "delivered":
      return "secondary";
    case "rejected":
    case "lost":
    case "stopped":
      return "destructive";
    default:
      return "outline";
  }
}

export function invoiceStatusVariant(status: InvoiceStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "paid":
      return "default";
    case "partially_paid":
      return "secondary";
    case "disputed":
      return "destructive";
    default:
      return "outline";
  }
}
