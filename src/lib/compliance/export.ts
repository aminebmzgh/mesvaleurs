import type { ExportTable } from "@/lib/exports/table";
import { formatAmount } from "@/lib/format";
import { PAYMENT_TYPE_LABELS } from "@/lib/labels";
import { type LegalParams, type PaymentDateBasis, type Quarter, quarterLabel, type StatementRow } from "./late-payments";

export const STATEMENT_KIND_LABELS: Record<StatementRow["kind"], string> = {
  late_paid: "Payée hors délai",
  unpaid: "Impayée",
};

export const BASIS_LABELS: Record<PaymentDateBasis, string> = {
  remittance: "remise du chèque, échéance de la LCN, date du virement",
  debit: "date de débit en banque",
};

/** État trimestriel des délais de paiement, pour l'expert-comptable (spec §10). */
export function statementTable(
  rows: StatementRow[],
  { organizationName, quarter, basis, params }: { organizationName: string; quarter: Quarter; basis: PaymentDateBasis; params: LegalParams },
): ExportTable {
  return {
    title: `État des délais de paiement — ${quarterLabel(quarter)}`,
    subtitle: `${organizationName} · loi 69-21, calculs indicatifs à valider par votre expert-comptable · date de paiement : ${BASIS_LABELS[basis]} · amende : ${formatAmount(params.firstMonthRate)} % le premier mois, ${formatAmount(params.additionalMonthRate)} % par mois supplémentaire`,
    columns: [
      { header: "Facture", kind: "text", width: 14 },
      { header: "Date facture", kind: "date", width: 11 },
      { header: "Date limite", kind: "date", width: 11 },
      { header: "Fournisseur", kind: "text", width: 24 },
      { header: "ICE", kind: "text", width: 17 },
      { header: "Montant TTC", kind: "amount", width: 13 },
      { header: "Situation", kind: "text", width: 15 },
      { header: "Montant concerné", kind: "amount", width: 14 },
      { header: "Mode", kind: "text", width: 9 },
      { header: "Référence", kind: "text", width: 13 },
      { header: "Date de paiement", kind: "date", width: 12 },
      { header: "Mois de retard", kind: "integer", width: 9 },
      { header: "Amende indicative", kind: "amount", width: 13 },
    ],
    rows: rows.map((row) => [
      row.invoiceNumber,
      row.invoiceDate,
      row.legalDueDate,
      row.supplier,
      row.ice,
      row.invoiceAmount,
      STATEMENT_KIND_LABELS[row.kind],
      row.amount,
      row.paymentType ? PAYMENT_TYPE_LABELS[row.paymentType] : null,
      row.paymentReference,
      row.paidOn,
      row.monthsLate,
      row.fine,
    ]),
  };
}
