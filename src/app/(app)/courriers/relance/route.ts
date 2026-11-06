import { planRefusal } from "@/lib/billing/guard";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { todayIso } from "@/lib/dates";
import { getLetterhead } from "@/lib/letters/data";
import { reminderDocument } from "@/lib/letters/documents";
import { letterPdf } from "@/lib/letters/pdf";
import { resolveLetterTemplate } from "@/lib/letters/queries";
import { letterReference } from "@/lib/letters/reference";
import { pdfResponse } from "@/lib/letters/response";
import { reminderSchema } from "@/lib/letters/schemas";

/** Lettre de relance d'un client (saisie libre, en attendant le module clients) : paramètres du formulaire. */
export async function GET(request: NextRequest) {
  const refusal = await planRefusal("standard_letters");
  if (refusal) {
    return refusal;
  }
  await requireActiveOrganization();
  const search = request.nextUrl.searchParams;
  const parsed = reminderSchema.safeParse(Object.fromEntries(search));
  if (!parsed.success) {
    return new NextResponse(z.prettifyError(parsed.error), { status: 400 });
  }
  const input = parsed.data;
  const [letterhead, template] = await Promise.all([getLetterhead(), resolveLetterTemplate("reminder", search.get("modele"))]);
  const date = todayIso();
  const reference = letterReference("RL", date);
  const doc = reminderDocument(
    {
      ...letterhead,
      place: letterhead.organization.city ?? "",
      date,
      reference,
      customer: { name: input.customer, lines: input.address.split("\n").map((line) => line.trim()).filter(Boolean) },
      invoices: input.invoices,
      amountDue: input.amount,
      deadline: input.deadline,
    },
    template,
  );
  return pdfResponse(await letterPdf(doc), `relance-${reference}.pdf`);
}
