import { type NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { getPostponementRequestData } from "@/lib/letters/courriers";
import { postponementRequestDocument } from "@/lib/letters/documents";
import { letterPdf } from "@/lib/letters/pdf";
import { resolveLetterTemplate } from "@/lib/letters/queries";
import { pdfResponse } from "@/lib/letters/response";

/** Demande de prorogation d'une LCN au fournisseur : `?echeance=AAAA-MM-JJ&motif=…&modele=…`. */
export async function GET(request: NextRequest, { params }: RouteContext<"/paiements/[id]/prorogation">) {
  await requireActiveOrganization();
  const { id } = await params;
  const search = request.nextUrl.searchParams;
  const newDue = search.get("echeance") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(newDue)) {
    return new NextResponse("Demande invalide.", { status: 400 });
  }
  const data = await getPostponementRequestData(id, newDue, (search.get("motif") ?? "").trim().slice(0, 300));
  if (!data || newDue <= data.lcn.dueDate) {
    return new NextResponse("LCN introuvable ou échéance demandée invalide.", { status: 404 });
  }
  const template = await resolveLetterTemplate("postponement_request", search.get("modele"));
  return pdfResponse(await letterPdf(postponementRequestDocument(data, template)), `prorogation-${data.reference}.pdf`);
}
