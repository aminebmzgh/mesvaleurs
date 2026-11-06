import { planRefusal } from "@/lib/billing/guard";
import { NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { getCoverLetterData } from "@/lib/letters/data";
import { remittanceSlipPdf } from "@/lib/letters/pdf";

/** Bordereau de remise des valeurs d'un lot (deux exemplaires sur la page). */
export async function GET(_request: Request, { params }: RouteContext<"/paiements/lots/[id]/bordereau">) {
  const refusal = await planRefusal("letters");
  if (refusal) {
    return refusal;
  }
  await requireActiveOrganization();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("Lot introuvable.", { status: 404 });
  }
  const data = await getCoverLetterData(id);
  if (!data) {
    return new NextResponse("Aucun paiement dans ce lot.", { status: 404 });
  }
  return new NextResponse(Buffer.from(await remittanceSlipPdf(data)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bordereau-${data.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
