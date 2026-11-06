import { planRefusal } from "@/lib/billing/guard";
import { type NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { pdfResponse } from "@/lib/letters/response";
import { envelopePdf, isEnvelopeFormat } from "@/lib/printing/envelope";
import { getBatchSupplierId, getEnvelopeAddresses } from "@/lib/printing/queries";

/** Enveloppe pour le règlement d'un lot, adressée à son fournisseur : `?format=DL|C5|C6`. */
export async function GET(request: NextRequest, { params }: RouteContext<"/paiements/lots/[id]/enveloppe">) {
  const refusal = await planRefusal("print_extras");
  if (refusal) {
    return refusal;
  }
  await requireActiveOrganization();
  const { id } = await params;
  const supplierId = /^[0-9a-f-]{36}$/i.test(id) ? await getBatchSupplierId(id) : null;
  const addresses = supplierId ? await getEnvelopeAddresses(supplierId) : null;
  if (!addresses) {
    return new NextResponse("Lot introuvable.", { status: 404 });
  }
  const format = request.nextUrl.searchParams.get("format");
  const bytes = await envelopePdf(isEnvelopeFormat(format) ? format : "DL", addresses.sender, [addresses.recipient]);
  return pdfResponse(bytes, "enveloppe.pdf");
}
