import { planRefusal } from "@/lib/billing/guard";
import { NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { pdfResponse } from "@/lib/letters/response";
import { receiptPdf } from "@/lib/receipts/pdf";
import { getReceiptPdfData } from "@/lib/receipts/queries";

/** Reçu PDF d'une remise signée. */
export async function GET(_request: Request, { params }: RouteContext<"/paiements/accuses/[id]/pdf">) {
  const refusal = await planRefusal("receipts");
  if (refusal) {
    return refusal;
  }
  await requireActiveOrganization();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("Accusé introuvable.", { status: 404 });
  }
  const data = await getReceiptPdfData(id);
  if (!data) {
    return new NextResponse("Accusé introuvable.", { status: 404 });
  }
  return pdfResponse(await receiptPdf(data), `accuse-${data.reference}.pdf`);
}
