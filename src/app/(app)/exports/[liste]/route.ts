import { type NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { todayIso } from "@/lib/dates";
import { invoicesTable, paymentsTable, suppliersTable } from "@/lib/exports/lists";
import { EXPORT_CONTENT_TYPES, type ExportTable, isExportFormat, toCsv, toPdf, toXlsx } from "@/lib/exports/table";
import { formatDate } from "@/lib/format";
import { listInvoices, type InvoiceFilter } from "@/lib/invoices/queries";
import { INVOICE_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, type PaymentType } from "@/lib/labels";
import { listPayments, type PaymentFilter } from "@/lib/payments/list";
import { listSuppliers } from "@/lib/suppliers/queries";

/** Lignes exportées au plus (au-delà, l'export le signale dans son sous-titre). */
const EXPORT_LIMIT = 5000;
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Export d'une liste avec les filtres de l'écran : `/exports/paiements|factures|fournisseurs`
 * `?format=csv|xlsx|pdf` et les mêmes paramètres que la page.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/exports/[liste]">) {
  const organization = await requireActiveOrganization();
  const { liste } = await params;
  const search = request.nextUrl.searchParams;
  const format = search.get("format");
  if (!isExportFormat(format)) {
    return new NextResponse("Format invalide.", { status: 400 });
  }
  const today = todayIso();
  const stamp = `${organization.organizationName} · export du ${formatDate(today)}`;
  let table: ExportTable;
  let truncated = false;

  if (liste === "paiements") {
    const statut = search.get("statut") ?? "circulation";
    const status = (["circulation", "all", ...Object.keys(PAYMENT_STATUS_LABELS).filter((s) => s !== "draft")].includes(statut) ? statut : "circulation") as PaymentFilter;
    const typeParam = search.get("type");
    const type = typeParam && typeParam in PAYMENT_TYPE_LABELS ? (typeParam as PaymentType) : undefined;
    const numero = search.get("numero")?.trim() ?? "";
    const result = await listPayments({ status, type, number: /^\d{1,12}$/.test(numero) ? Number(numero) : undefined, limit: EXPORT_LIMIT });
    truncated = result.truncated;
    table = paymentsTable(result.payments, stamp);
  } else if (liste === "factures") {
    const statut = search.get("statut") ?? "open";
    const status = (["open", "all", ...Object.keys(INVOICE_STATUS_LABELS)].includes(statut) ? statut : "open") as InvoiceFilter;
    const supplier = search.get("fournisseur");
    const result = await listInvoices({
      search: search.get("q") ?? "",
      status,
      supplierId: supplier && UUID.test(supplier) ? supplier : undefined,
      limit: EXPORT_LIMIT,
    });
    truncated = result.truncated;
    table = invoicesTable(result.invoices, stamp);
  } else if (liste === "fournisseurs") {
    const result = await listSuppliers({ search: search.get("q") ?? "", archived: search.get("archives") === "1", limit: EXPORT_LIMIT });
    truncated = result.truncated;
    table = suppliersTable(result.suppliers, stamp);
  } else {
    return new NextResponse("Liste inconnue.", { status: 404 });
  }
  if (truncated) {
    table.subtitle = `${table.subtitle} · limité aux ${EXPORT_LIMIT} premières lignes`;
  }

  const body = format === "csv" ? toCsv(table) : Buffer.from(format === "xlsx" ? toXlsx(table) : await toPdf(table));
  return new NextResponse(body, {
    headers: {
      "Content-Type": EXPORT_CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${liste}-${today}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
