import { type NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { renderInstrumentsPdf } from "@/lib/printing/pdf";
import { getBatchPrintJob, loadBackground } from "@/lib/printing/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * PDF d'un lot de chèques ou de LCN, une page par formule, au millimètre.
 * `?test=1` : impression test sur papier blanc, avec la formule scannée en fond et
 * le contour des zones (non comptée comme impression).
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/paiements/lots/[id]/pdf">) {
  await requireRole(WRITER_ROLES);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("Lot introuvable.", { status: 404 });
  }
  // Double signature : aucune impression (même test) avant validation
  const supabase = await createClient();
  const { data: batch } = await supabase.from("print_batches").select("approval_status").eq("id", id).maybeSingle();
  if (batch?.approval_status === "pending" || batch?.approval_status === "refused") {
    return new NextResponse("Ce lot n'a pas été validé : il ne peut pas être imprimé.", { status: 409 });
  }
  const job = await getBatchPrintJob(id);
  if (!job) {
    return new NextResponse("Aucune formule à imprimer dans ce lot.", { status: 404 });
  }

  const isTest = request.nextUrl.searchParams.get("test") === "1";
  const { bytes } = await renderInstrumentsPdf({
    template: job.template,
    items: job.items,
    test: isTest ? { background: await loadBackground(job.backgroundPath), showZones: true } : undefined,
  });

  if (!isTest) {
    // Première impression ou réimpression : tracée dans le journal d'audit
    await supabase.rpc("record_batch_print", { p_batch_id: id });
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${isTest ? "test-" : ""}lot-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
