import { type NextRequest, NextResponse } from "next/server";
import { statementTable } from "@/lib/compliance/export";
import { parseQuarterKey, quarterKey } from "@/lib/compliance/late-payments";
import { getCompliance } from "@/lib/compliance/queries";
import { EXPORT_CONTENT_TYPES, isExportFormat, toCsv, toPdf, toXlsx } from "@/lib/exports/table";

/** État trimestriel loi 69-21 : `/conformite/export?trimestre=2026-T3&format=csv|xlsx|pdf`. */
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");
  if (!isExportFormat(format)) {
    return new NextResponse("Format invalide.", { status: 400 });
  }
  const compliance = await getCompliance(parseQuarterKey(request.nextUrl.searchParams.get("trimestre")));
  const table = statementTable(compliance.rows, {
    organizationName: compliance.organization.organizationName,
    quarter: compliance.quarter,
    basis: compliance.basis,
    params: compliance.params,
  });
  const body = format === "csv" ? toCsv(table) : Buffer.from(format === "xlsx" ? toXlsx(table) : await toPdf(table));
  return new NextResponse(body, {
    headers: {
      "Content-Type": EXPORT_CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="delais-de-paiement-${quarterKey(compliance.quarter)}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
