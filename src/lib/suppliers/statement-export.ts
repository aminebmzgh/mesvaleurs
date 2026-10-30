import { z } from "zod";
import type { ExportTable } from "@/lib/exports/table";
import { formatDate, formatMAD } from "@/lib/format";
import type { MatchRow, MatchStatus, SupplierComparison } from "./statement-match";

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  matched: "Concordant",
  amount_diff: "Montant différent",
  missing_ours: "Absent de nos livres",
  missing_theirs: "Absent du relevé",
};

export const MATCH_KIND_LABELS: Record<MatchRow["kind"], string> = { invoice: "Facture", payment: "Règlement" };

const isoDate = z.iso.date();
const side = z.object({ date: isoDate, label: z.string().max(500), amount: z.number().finite() });

/** Rapport envoyé par le navigateur pour l'export (le relevé n'est lu que côté navigateur). */
export const comparisonExportSchema = z.object({
  format: z.enum(["csv", "xlsx", "pdf"]),
  period: z.object({ start: isoDate, end: isoDate }).nullable(),
  totals: z.object({ theirs: z.number().finite(), ours: z.number().finite(), difference: z.number().finite() }),
  rows: z
    .array(
      z.object({
        kind: z.enum(["invoice", "payment"]),
        status: z.enum(["matched", "amount_diff", "missing_ours", "missing_theirs"]),
        probable: z.boolean(),
        theirs: side.extend({ reference: z.string().max(120).nullable() }).nullable(),
        ours: side.extend({ id: z.string() }).nullable(),
        difference: z.number().finite(),
      }),
    )
    .max(5000),
});

export function comparisonTable(comparison: Pick<SupplierComparison, "period" | "rows" | "totals">, supplierName: string, organizationName: string): ExportTable {
  const { period, totals } = comparison;
  return {
    title: `Rapprochement du relevé ${supplierName}`,
    subtitle: [
      organizationName,
      period ? `du ${formatDate(period.start)} au ${formatDate(period.end)}` : null,
      `solde de la période selon le fournisseur ${formatMAD(totals.theirs)}, selon nos livres ${formatMAD(totals.ours)}, écart ${formatMAD(totals.difference)}`,
    ]
      .filter(Boolean)
      .join(" · "),
    columns: [
      { header: "Situation", kind: "text", width: 18 },
      { header: "Type", kind: "text", width: 10 },
      { header: "Date (fournisseur)", kind: "date", width: 11 },
      { header: "Pièce (fournisseur)", kind: "text", width: 28 },
      { header: "Montant (fournisseur)", kind: "amount", width: 14 },
      { header: "Nos livres", kind: "text", width: 22 },
      { header: "Date (nos livres)", kind: "date", width: 11 },
      { header: "Montant (nos livres)", kind: "amount", width: 14 },
      { header: "Écart", kind: "amount", width: 12 },
    ],
    rows: comparison.rows.map((row) => [
      `${MATCH_STATUS_LABELS[row.status]}${row.probable ? " (montant et date)" : ""}`,
      MATCH_KIND_LABELS[row.kind],
      row.theirs?.date ?? null,
      row.theirs ? [row.theirs.reference, row.theirs.label].filter(Boolean).join(" · ") : "",
      row.theirs?.amount ?? null,
      row.ours?.label ?? "",
      row.ours?.date ?? null,
      row.ours?.amount ?? null,
      row.difference,
    ]),
  };
}
