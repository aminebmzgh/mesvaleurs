import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { renderInstrumentsPdf } from "@/lib/printing/pdf";
import { getTemplate, loadBackground, sampleData } from "@/lib/printing/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Impression test d'un modèle : données d'exemple, scan de la formule en fond et
 * contour des zones. À imprimer sur papier blanc puis à superposer à une vraie
 * formule pour ajuster les zones et le décalage imprimante.
 */
export async function GET(_request: Request, { params }: RouteContext<"/comptes-bancaires/modeles/[id]/test">) {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const { id } = await params;
  const template = /^[0-9a-f-]{36}$/i.test(id) ? await getTemplate(id) : null;
  if (!template) {
    return new NextResponse("Modèle introuvable.", { status: 404 });
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, city")
    .eq("id", organization.organizationId)
    .single();
  const { bytes } = await renderInstrumentsPdf({
    template,
    items: [sampleData(template.type, organization.amountWordsRectified, { name: org?.name ?? "", city: org?.city ?? "" })],
    test: { background: await loadBackground(template.backgroundPath), showZones: true },
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="impression-test.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
