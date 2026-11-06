import { planRefusal } from "@/lib/billing/guard";
import { type NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { getOppositionData } from "@/lib/letters/courriers";
import { oppositionDocument } from "@/lib/letters/documents";
import { letterPdf } from "@/lib/letters/pdf";
import { resolveLetterTemplate } from "@/lib/letters/queries";
import { pdfResponse } from "@/lib/letters/response";

/** Lettre d'opposition à la banque d'une opposition enregistrée : `?modele=<clé ou identifiant>`. */
export async function GET(request: NextRequest, { params }: RouteContext<"/paiements/oppositions/[id]/lettre">) {
  const refusal = await planRefusal("standard_letters");
  if (refusal) {
    return refusal;
  }
  await requireActiveOrganization();
  const { id } = await params;
  const data = /^[0-9a-f-]{36}$/i.test(id) ? await getOppositionData(id) : null;
  if (!data) {
    return new NextResponse("Opposition introuvable.", { status: 404 });
  }
  const template = await resolveLetterTemplate("opposition", request.nextUrl.searchParams.get("modele"));
  return pdfResponse(await letterPdf(oppositionDocument(data, template)), `opposition-${data.reference}.pdf`);
}
