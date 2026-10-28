import { type NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { getCoverLetterData } from "@/lib/letters/data";
import { coverLetterPdf } from "@/lib/letters/pdf";
import { BUILTIN_LETTER_TEMPLATES, suggestedTemplateKey } from "@/lib/letters/templates";

/** Lettre d'accompagnement d'un lot : `?modele=<clé>&exemplaires=1|2`. */
export async function GET(request: NextRequest, { params }: RouteContext<"/paiements/lots/[id]/lettre">) {
  const organization = await requireActiveOrganization();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("Lot introuvable.", { status: 404 });
  }
  const data = await getCoverLetterData(id);
  if (!data) {
    return new NextResponse("Aucun paiement dans ce lot.", { status: 404 });
  }
  const search = request.nextUrl.searchParams;
  const key = search.get("modele") ?? suggestedTemplateKey({ hasLcn: data.hasLcn, remainingCents: Math.round(data.remaining * 100) });
  const template = BUILTIN_LETTER_TEMPLATES.find((t) => t.key === key) ?? BUILTIN_LETTER_TEMPLATES[0];
  const bytes = await coverLetterPdf(data, template, {
    copies: search.get("exemplaires") === "2" ? 2 : 1,
    rectified: organization.amountWordsRectified,
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lettre-${data.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
