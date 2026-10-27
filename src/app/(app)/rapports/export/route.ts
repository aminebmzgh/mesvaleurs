import { type NextRequest, NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { reportPdf, reportWorkbook } from "@/lib/reports/export";
import { getMonthlyReport } from "@/lib/reports/monthly";
import { isMonth } from "@/lib/reports/period";

/** Export du rapport de fin de mois : `?mois=AAAA-MM&compte=<id>&format=xlsx|pdf`. */
export async function GET(request: NextRequest) {
  await requireActiveOrganization();
  const params = request.nextUrl.searchParams;
  const month = params.get("mois");
  const format = params.get("format");
  const account = params.get("compte");
  if (!isMonth(month) || (format !== "xlsx" && format !== "pdf")) {
    return new NextResponse("Paramètres invalides.", { status: 400 });
  }
  const report = await getMonthlyReport(month, account && /^[0-9a-f-]{36}$/i.test(account) ? account : undefined);
  const filename = `rapport-${month}.${format}`;

  const bytes = format === "xlsx" ? reportWorkbook(report) : await reportPdf(report);
  const body = new Uint8Array(bytes);
  return new NextResponse(body, {
    headers: {
      "Content-Type":
        format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
