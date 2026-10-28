import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];
export type InvoiceStatus = Enums["invoice_status"];
export type PaymentStatus = Enums["payment_status"];
export type PaymentType = Enums["payment_type"];

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
