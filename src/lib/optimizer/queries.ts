import "server-only";
import { toCents } from "@/lib/amount";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { loadLegalParams } from "@/lib/compliance/data";
import { getForecast } from "@/lib/forecast/queries";
import { createClient } from "@/lib/supabase/server";
import { buildPaymentPlan, type PlanInvoice } from "./plan";

/**
 * Plan de paiement des factures en attente (non contestées), sur la trésorerie
 * prévisionnelle de tous les comptes actifs : engagements actuels (chèques en circulation,
 * LCN à échoir, virements), sans les factures elles-mêmes.
 */
export async function getPaymentPlan(reserveOverride: number | null) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const [{ today, forecast }, invoices, params] = await Promise.all([
    getForecast({ includeInvoices: false }),
    supabase
      .from("invoices")
      .select("id, number, amount_incl_tax, amount_paid, legal_due_date, issue_date, suppliers ( id, name, is_strategic )")
      .eq("organization_id", organization.organizationId)
      .in("status", ["unpaid", "partially_paid"]),
    loadLegalParams(supabase),
  ]);
  if (invoices.error) {
    throw new Error("Impossible de calculer le plan de paiement.", { cause: invoices.error });
  }
  const open: PlanInvoice[] = (invoices.data ?? []).flatMap((invoice) => {
    const remaining = Math.max(toCents(invoice.amount_incl_tax) - toCents(invoice.amount_paid), 0) / 100;
    return remaining > 0 && invoice.suppliers
      ? [
          {
            id: invoice.id,
            number: invoice.number,
            supplierId: invoice.suppliers.id,
            supplierName: invoice.suppliers.name,
            strategic: invoice.suppliers.is_strategic,
            legalDueDate: invoice.legal_due_date ?? invoice.issue_date,
            amount: invoice.amount_incl_tax,
            remaining,
          },
        ]
      : [];
  });
  const reserve = reserveOverride ?? organization.paymentReserve;
  return {
    organization,
    today,
    plan: buildPaymentPlan({ today, balances: forecast.days, invoices: open, reserve, params }),
  };
}
