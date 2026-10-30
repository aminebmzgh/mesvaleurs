import { type NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { todayIso } from "@/lib/dates";
import { getStatementRequestData } from "@/lib/letters/courriers";
import { statementRequestDocument } from "@/lib/letters/documents";
import { letterPdf } from "@/lib/letters/pdf";
import { resolveLetterTemplate } from "@/lib/letters/queries";
import { pdfResponse } from "@/lib/letters/response";

/** Demande de relevé de compte au fournisseur : `?au=AAAA-MM-JJ&modele=…`. */
export async function GET(request: NextRequest, { params }: RouteContext<"/fournisseurs/[id]/releve">) {
  await requireActiveOrganization();
  const { id } = await params;
  const search = request.nextUrl.searchParams;
  const asOf = search.get("au") ?? todayIso();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    return new NextResponse("Demande invalide.", { status: 400 });
  }
  const data = await getStatementRequestData(id, asOf);
  if (!data) {
    return new NextResponse("Fournisseur introuvable.", { status: 404 });
  }
  const template = await resolveLetterTemplate("statement_request", search.get("modele"));
  return pdfResponse(await letterPdf(statementRequestDocument(data, template)), `releve-${data.reference}.pdf`);
}
