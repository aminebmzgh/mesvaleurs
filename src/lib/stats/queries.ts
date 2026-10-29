import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { computeStatistics, monthsBetween, type StatPayment } from "./stats";

/**
 * Statistiques des règlements émis entre deux mois (inclus) : chèques, LCN et virements
 * émis, remis ou débités (ni brouillons, ni annulés, ni rejetés ; garanties exclues).
 */
export async function getStatistics(fromMonth: string, toMonth: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const months = monthsBetween(fromMonth, toMonth);
  const [year, month] = toMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const { data, error } = await supabase
    .from("payments")
    .select("type, amount, issue_date, delivered_at, suppliers ( id, name ), payment_allocations ( amount, invoices ( issue_date ) )")
    .eq("organization_id", organization.organizationId)
    .in("status", ["issued", "delivered", "paid"])
    .in("type", ["check", "lcn", "transfer"])
    .gte("issue_date", `${fromMonth}-01`)
    .lte("issue_date", `${toMonth}-${String(lastDay).padStart(2, "0")}`)
    .limit(20000);
  if (error) {
    throw new Error("Impossible de calculer les statistiques.", { cause: error });
  }

  const payments: StatPayment[] = data.flatMap((p) =>
    p.suppliers && p.type !== "guarantee_check"
      ? [
          {
            type: p.type,
            amount: p.amount,
            issueDate: p.issue_date,
            paidOn: p.delivered_at ?? p.issue_date,
            supplier: { id: p.suppliers.id, name: p.suppliers.name },
            allocations: p.payment_allocations.flatMap((a) => (a.invoices ? [{ amount: a.amount, invoiceDate: a.invoices.issue_date }] : [])),
          },
        ]
      : [],
  );
  return computeStatistics(payments, months);
}
