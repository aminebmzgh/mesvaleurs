import { type NextRequest, NextResponse } from "next/server";
import { actionLabel, changedFields, describeRecord, fieldLabel, formatValue, tableLabel } from "@/lib/audit/entries";
import { exportAuditEntries, parseAuditFilters } from "@/lib/audit/queries";
import { formatDateTime } from "@/lib/format";

type Row = Record<string, unknown>;

// Champ CSV : guillemets doublés, et neutralisation des formules à l'ouverture dans Excel
const cell = (value: string) => `"${(/^[=+\-@]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;

/** Export CSV du journal d'audit, mêmes filtres que l'écran (`?du=&au=&auteur=&objet=&action=`). */
export async function GET(request: NextRequest) {
  const filters = parseAuditFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { entries } = await exportAuditEntries(filters);

  const lines = [["Date", "Auteur", "Action", "Objet", "Désignation", "Détail"].map(cell).join(";")];
  for (const entry of entries) {
    const before = entry.before as Row | null;
    const after = entry.after as Row | null;
    const detail = changedFields(before, after)
      .map(({ field, before: old, after: now }) =>
        entry.action === "update"
          ? `${fieldLabel(field)} : ${formatValue(entry.table_name, field, old)} → ${formatValue(entry.table_name, field, now)}`
          : `${fieldLabel(field)} : ${formatValue(entry.table_name, field, entry.action === "delete" ? old : now)}`,
      )
      .join(" | ");
    lines.push(
      [
        entry.created_at ? formatDateTime(entry.created_at) : "",
        entry.actor_name || entry.actor_email || "Système",
        actionLabel(entry.action ?? ""),
        tableLabel(entry.table_name),
        describeRecord(entry.table_name, before, after, entry.details as Row | null),
        detail,
      ]
        .map(cell)
        .join(";"),
    );
  }

  // BOM : Excel reconnaît l'UTF-8 (accents) ; point-virgule, séparateur attendu en français
  return new NextResponse(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="journal-audit.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
