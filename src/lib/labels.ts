import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];
export type InvoiceStatus = Enums["invoice_status"];
export type PaymentStatus = Enums["payment_status"];
export type PaymentType = Enums["payment_type"];
export type RejectionKind = Enums["rejection_kind"];
export type RegularizationMethod = Enums["regularization_method"];
export type StopOrderReason = Enums["stop_order_reason"];

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

export const STOP_ORDER_REASON_LABELS: Record<StopOrderReason, string> = {
  lost: "Perte",
  stolen: "Vol",
  fraudulent_use: "Utilisation frauduleuse",
  holder_insolvency: "Redressement ou liquidation judiciaire du porteur",
};

/** Motifs d'opposition admis selon la valeur (Code de commerce, à faire valider par un juriste). */
export function stopOrderReasonsFor(target: "check" | "lcn" | "blank"): StopOrderReason[] {
  if (target === "blank") {
    return ["lost", "stolen"];
  }
  return target === "lcn" ? ["lost", "stolen", "holder_insolvency"] : ["lost", "stolen", "fraudulent_use", "holder_insolvency"];
}

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
