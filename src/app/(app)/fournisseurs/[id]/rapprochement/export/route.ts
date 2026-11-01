import { type NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { EXPORT_CONTENT_TYPES, toCsv, toPdf, toXlsx } from "@/lib/exports/table";
import { getSupplier } from "@/lib/suppliers/queries";
import { comparisonExportSchema, comparisonTable } from "@/lib/suppliers/statement-export";

/**
 * Rapport de rapprochement avec le relevé d'un fournisseur (CSV, Excel ou PDF). Le relevé
 * est lu dans le navigateur : le rapport calculé est envoyé ici pour être mis en forme.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("Fournisseur introuvable.", { status: 404 });
  }
  const parsed = comparisonExportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new NextResponse("Rapport invalide.", { status: 400 });
  }
  const [organization, supplier] = await Promise.all([requireActiveOrganization(), getSupplier(id)]);
  if (!supplier) {
    return new NextResponse("Fournisseur introuvable.", { status: 404 });
  }
  const { format, ...comparison } = parsed.data;
  const table = comparisonTable(comparison, supplier.name, organization.organizationName);
  const body = format === "csv" ? toCsv(table) : Buffer.from(format === "xlsx" ? toXlsx(table) : await toPdf(table));
  return new NextResponse(body, {
    headers: {
      "Content-Type": EXPORT_CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="rapprochement-fournisseur.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
