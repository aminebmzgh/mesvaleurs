import { formatMAD } from "@/lib/format";
import type { AiInvoice } from "./ai-reading";

/**
 * Détection d'anomalies sur une facture lue (spec §9) : doublon (même fournisseur, même
 * numéro), facture déjà soldée, montant inhabituel par rapport à l'historique du
 * fournisseur, totaux ou TVA incohérents, dates douteuses. Signalées à l'utilisateur
 * avant l'enregistrement ; seul le doublon est bloquant (contrainte unique en base).
 */
export type InvoiceAnomaly = { level: "error" | "warning"; message: string };

export type AnomalyContext = {
  /** Facture déjà enregistrée pour ce fournisseur avec ce numéro. */
  duplicate: { status: string } | null;
  /** Montants TTC des factures précédentes du fournisseur. */
  supplierHistory: number[];
  organizationIce: string | null;
  today: string;
};

/** Taux de TVA en vigueur au Maroc (%). */
export const VAT_RATES = [0, 7, 10, 14, 20] as const;
/** Historique minimal pour juger un montant inhabituel. */
const MIN_HISTORY = 3;
/** Montant inhabituel : au-delà de ce multiple de la facture habituelle (médiane), ou en deçà de son inverse. */
const UNUSUAL_RATIO = 3;

const cents = (value: number) => Math.round(value * 100);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function detectInvoiceAnomalies(invoice: AiInvoice, context: AnomalyContext): InvoiceAnomaly[] {
  const anomalies: InvoiceAnomaly[] = [];
  const warn = (message: string) => anomalies.push({ level: "warning", message });

  if (!invoice.isInvoice) {
    warn("Ce document ne ressemble pas à une facture (devis, bon de livraison, relevé ?).");
  }
  if (context.duplicate) {
    anomalies.push({
      level: "error",
      message:
        context.duplicate.status === "paid"
          ? `Facture ${invoice.number} déjà enregistrée pour ce fournisseur et déjà soldée : ne la payez pas deux fois.`
          : `Facture ${invoice.number} déjà enregistrée pour ce fournisseur.`,
    });
  }
  if (invoice.currency && invoice.currency !== "MAD") {
    warn(`Facture en ${invoice.currency} : saisissez les montants en dirhams.`);
  }

  const missing = [
    !invoice.supplier.name && "fournisseur",
    !invoice.number && "numéro",
    !invoice.issueDate && "date",
    invoice.amountInclTax === null && "montant TTC",
  ].filter(Boolean);
  if (missing.length > 0) {
    warn(`Non lu sur la facture : ${missing.join(", ")}. Complétez le formulaire.`);
  }

  const { amountExclTax: excl, vatAmount: vat, amountInclTax: incl } = invoice;
  if (excl !== null && vat !== null && incl !== null) {
    if (cents(excl) + cents(vat) !== cents(incl)) {
      warn(`Totaux incohérents : HT ${formatMAD(excl)} + TVA ${formatMAD(vat)} ≠ TTC ${formatMAD(incl)}.`);
    } else if (excl > 0) {
      const rate = (vat / excl) * 100;
      // Tolérance d'arrondi : 0,05 point
      if (!VAT_RATES.some((standard) => Math.abs(rate - standard) <= 0.05)) {
        warn(`Taux de TVA inhabituel (${rate.toFixed(2).replace(".", ",")} %) : plusieurs taux sur la facture, ou erreur de lecture ?`);
      }
    }
  }

  if (invoice.issueDate && invoice.issueDate > context.today) {
    warn("Date de facture dans le futur : vérifiez-la.");
  }
  if (invoice.issueDate && invoice.dueDate && invoice.dueDate < invoice.issueDate) {
    warn("Échéance antérieure à la date de facture : vérifiez-les.");
  }
  if (!invoice.supplier.ice) {
    warn("ICE du fournisseur non lu : mention obligatoire sur une facture.");
  }
  if (context.organizationIce && invoice.customerIce && invoice.customerIce !== context.organizationIce) {
    warn(`Facture adressée à l'ICE ${invoice.customerIce}, qui n'est pas celui de votre entreprise.`);
  }

  const history = context.supplierHistory.filter((value) => value > 0);
  if (incl !== null && incl > 0 && history.length >= MIN_HISTORY) {
    const usual = median(history);
    if (incl > usual * UNUSUAL_RATIO || incl < usual / UNUSUAL_RATIO) {
      warn(`Montant inhabituel pour ce fournisseur : ${formatMAD(incl)}, contre ${formatMAD(usual)} d'habitude (médiane de ${history.length} factures).`);
    }
  }
  return anomalies;
}
