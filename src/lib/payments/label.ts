import { formatInstrumentNumber } from "@/lib/checkbooks";
import { PAYMENT_TYPE_LABELS, type PaymentType } from "@/lib/labels";

type PaymentIdentity = {
  number: number | null;
  reference?: string | null;
  checkbooks?: { number_width: number } | null;
};

/** Numéro de la formule (zéros initiaux compris), ou référence d'un virement. */
export function paymentNumber(payment: PaymentIdentity): string {
  if (payment.number != null) {
    return formatInstrumentNumber(payment.number, payment.checkbooks?.number_width ?? 7);
  }
  return payment.reference ?? "";
}

/** « Chèque 0001003 », « LCN 5000102 », « Virement VIR-2026-118 ». */
export function paymentLabel(payment: PaymentIdentity & { type: PaymentType }): string {
  return `${PAYMENT_TYPE_LABELS[payment.type]} ${paymentNumber(payment)}`.trim();
}
