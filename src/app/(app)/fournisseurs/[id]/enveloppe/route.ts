import { planRefusal } from "@/lib/billing/guard";
import { type NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { pdfResponse } from "@/lib/letters/response";
import { envelopePdf, isEnvelopeFormat } from "@/lib/printing/envelope";
import { getEnvelopeAddresses } from "@/lib/printing/queries";

/** Enveloppe adressée au fournisseur : `?format=DL|C5|C6` (DL par défaut). */
export async function GET(request: NextRequest, { params }: RouteContext<"/fournisseurs/[id]/enveloppe">) {
  const refusal = await planRefusal("print_extras");
  if (refusal) {
    return refusal;
  }
  await requireActiveOrganization();
  const { id } = await params;
  const addresses = /^[0-9a-f-]{36}$/i.test(id) ? await getEnvelopeAddresses(id) : null;
  if (!addresses) {
    return new NextResponse("Fournisseur introuvable.", { status: 404 });
  }
  const format = request.nextUrl.searchParams.get("format");
  const bytes = await envelopePdf(isEnvelopeFormat(format) ? format : "DL", addresses.sender, [addresses.recipient]);
  return pdfResponse(bytes, "enveloppe.pdf");
}
