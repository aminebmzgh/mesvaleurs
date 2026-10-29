import { type NextRequest, NextResponse } from "next/server";
import { journalCsv } from "@/lib/accounting/journal";
import { getJournal } from "@/lib/accounting/queries";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { isMonth } from "@/lib/reports/period";

/** Export comptable mensuel (journal des règlements fournisseurs) : `?mois=AAAA-MM`. */
export async function GET(request: NextRequest) {
  await requireActiveOrganization();
  const month = request.nextUrl.searchParams.get("mois");
  if (!isMonth(month)) {
    return new NextResponse("Mois invalide.", { status: 400 });
  }
  const { settings, lines } = await getJournal(month);
  return new NextResponse(journalCsv(lines, settings), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="journal-reglements-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
