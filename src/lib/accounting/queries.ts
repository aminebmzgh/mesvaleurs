import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { parseOrganizationSettings } from "@/lib/organizations/settings";
import { paymentLabel, paymentNumber } from "@/lib/payments/label";
import { createClient } from "@/lib/supabase/server";
import { journalEntries, type JournalPayment } from "./journal";

const COLUMNS =
  "id, type, number, reference, amount, issue_date, debited_at, suppliers ( name, accounting_code ), bank_accounts ( accounting_code ), checkbooks ( number_width ), payment_allocations ( invoices ( number ) )";

/**
 * Journal des règlements fournisseurs d'un mois « AAAA-MM », selon les paramètres de
 * l'entreprise. Règlements émis, remis ou débités (ni brouillons, ni annulés, ni rejetés).
 */
export async function getJournal(month: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const [year, m] = month.split("-").map(Number);
  const [from, to] = [`${month}-01`, `${month}-${String(new Date(Date.UTC(year, m, 0)).getUTCDate()).padStart(2, "0")}`];

  const { data: org, error: orgError } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  if (orgError) {
    throw new Error("Impossible de préparer l'export comptable.", { cause: orgError });
  }
  const settings = parseOrganizationSettings(org.settings).accounting_export;

  // Débités dans le mois (toutes bases) ; émis dans le mois (base « émission »)
  const [debited, issued] = await Promise.all([
    supabase.from("payments").select(COLUMNS).eq("organization_id", orgId).eq("status", "paid").gte("debited_at", from).lte("debited_at", to).limit(10000),
    settings.basis === "issue"
      ? supabase
          .from("payments")
          .select(COLUMNS)
          .eq("organization_id", orgId)
          .in("status", ["issued", "delivered", "paid"])
          .neq("type", "guarantee_check")
          .gte("issue_date", from)
          .lte("issue_date", to)
          .limit(10000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = debited.error ?? issued.error;
  if (error) {
    throw new Error("Impossible de préparer l'export comptable.", { cause: error });
  }

  const byId = new Map([...(debited.data ?? []), ...(issued.data ?? [])].map((p) => [p.id, p]));
  const payments: JournalPayment[] = [...byId.values()].map((p) => ({
    type: p.type,
    piece: paymentNumber(p),
    label: paymentLabel(p),
    amount: p.amount,
    issueDate: p.issue_date,
    debitedAt: p.debited_at,
    supplier: { name: p.suppliers?.name ?? "", accountingCode: p.suppliers?.accounting_code ?? null },
    bankAccountCode: p.bank_accounts?.accounting_code ?? null,
    invoices: p.payment_allocations.flatMap((a) => (a.invoices ? [a.invoices.number] : [])),
  }));
  return { settings, lines: journalEntries(payments, month, settings) };
}
