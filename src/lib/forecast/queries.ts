import "server-only";
import { toCents } from "@/lib/amount";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { addDays, todayIso } from "@/lib/dates";
import { paymentLabel } from "@/lib/payments/label";
import { createClient } from "@/lib/supabase/server";
import { type CalendarEvent, dueStatus } from "./calendar";
import { buildForecast, FORECAST_HORIZON_DAYS, type ForecastMovement, plannedDate } from "./forecast";

/**
 * Prévision de trésorerie des comptes actifs (ou d'un compte) : chèques, LCN et virements
 * en circulation ; factures à payer à leur échéance légale en option (toutes les factures,
 * sans compte attribué : seulement pour l'ensemble des comptes). Chèques de garantie exclus.
 */
export async function getForecast({ accountId, includeInvoices }: { accountId?: string; includeInvoices: boolean }) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const today = todayIso();
  const horizon = addDays(today, FORECAST_HORIZON_DAYS);

  let paymentsQuery = supabase
    .from("payments")
    .select("id, type, number, reference, amount, issue_date, due_date, bank_account_id, print_batch_id, suppliers ( name ), checkbooks ( number_width )")
    .eq("organization_id", orgId)
    .in("status", ["issued", "delivered"])
    .in("type", ["check", "lcn", "transfer"]);
  if (accountId) {
    paymentsQuery = paymentsQuery.eq("bank_account_id", accountId);
  }
  const withInvoices = includeInvoices && !accountId;
  const [accounts, payments, invoices] = await Promise.all([
    supabase.from("bank_accounts").select("id, label, current_balance").eq("organization_id", orgId).eq("is_active", true).order("label"),
    paymentsQuery,
    withInvoices
      ? supabase
          .from("invoices")
          .select("id, number, amount_incl_tax, amount_paid, legal_due_date, issue_date, suppliers ( name )")
          .eq("organization_id", orgId)
          .in("status", ["unpaid", "partially_paid"])
          .lte("legal_due_date", horizon)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = accounts.error ?? payments.error ?? invoices.error;
  if (error) {
    throw new Error("Impossible de calculer la prévision de trésorerie.", { cause: error });
  }

  const activeAccounts = accounts.data ?? [];
  const accountIds = new Set(activeAccounts.map((a) => a.id));
  const scoped = accountId ? activeAccounts.filter((a) => a.id === accountId) : activeAccounts;
  const openingBalance = scoped.reduce((sum, a) => sum + toCents(a.current_balance), 0) / 100;

  const movements: ForecastMovement[] = [
    ...(payments.data ?? [])
      .filter((p) => accountIds.has(p.bank_account_id))
      .map((p) => {
        const kind = p.type === "lcn" ? "lcn" : p.type === "transfer" ? "transfer" : "check";
        return {
          date: plannedDate(kind, kind === "lcn" ? p.due_date : p.issue_date, today),
          amount: p.amount,
          kind,
          label: paymentLabel(p),
          supplier: p.suppliers?.name ?? "",
          href: p.print_batch_id ? `/paiements/lots/${p.print_batch_id}` : `/paiements?numero=${p.number ?? ""}&statut=all`,
        } satisfies ForecastMovement;
      }),
    ...(invoices.data ?? []).flatMap((invoice) => {
      const remaining = Math.max(toCents(invoice.amount_incl_tax) - toCents(invoice.amount_paid), 0) / 100;
      return remaining > 0
        ? [
            {
              date: plannedDate("invoice", invoice.legal_due_date ?? invoice.issue_date, today),
              amount: remaining,
              kind: "invoice" as const,
              label: `Facture ${invoice.number}`,
              supplier: invoice.suppliers?.name ?? "",
              href: `/factures/${invoice.id}`,
            },
          ]
        : [];
    }),
  ];

  return {
    today,
    accounts: activeAccounts.map((a) => ({ id: a.id, label: a.label })),
    forecast: buildForecast(openingBalance, movements, today),
    withInvoices,
  };
}

/** Échéances entre deux dates (incluses) : LCN, dates limites des factures, restitutions de garantie. */
export async function getCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const today = todayIso();
  const [lcns, invoices, guarantees] = await Promise.all([
    supabase
      .from("payments")
      .select("id, type, status, number, reference, amount, due_date, print_batch_id, suppliers ( name ), checkbooks ( number_width )")
      .eq("organization_id", orgId)
      .eq("type", "lcn")
      .in("status", ["issued", "delivered", "paid", "rejected"])
      .gte("due_date", from)
      .lte("due_date", to),
    supabase
      .from("invoices")
      .select("id, number, status, amount_incl_tax, amount_paid, legal_due_date, suppliers ( name )")
      .eq("organization_id", orgId)
      .neq("status", "disputed")
      .gte("legal_due_date", from)
      .lte("legal_due_date", to),
    supabase
      .from("payments")
      .select("id, type, number, reference, amount, guarantee_return_due, print_batch_id, suppliers ( name ), checkbooks ( number_width )")
      .eq("organization_id", orgId)
      .eq("type", "guarantee_check")
      .in("status", ["issued", "delivered"])
      .gte("guarantee_return_due", from)
      .lte("guarantee_return_due", to),
  ]);
  const error = lcns.error ?? invoices.error ?? guarantees.error;
  if (error) {
    throw new Error("Impossible de charger le calendrier.", { cause: error });
  }
  const paymentHref = (p: { print_batch_id: string | null; number: number | null }) =>
    p.print_batch_id ? `/paiements/lots/${p.print_batch_id}` : `/paiements?numero=${p.number ?? ""}&statut=all`;

  const events: CalendarEvent[] = [
    ...(lcns.data ?? []).map((p) => ({
      date: p.due_date!,
      kind: "lcn" as const,
      // Une LCN rejetée à l'échéance est en retard, comme une LCN échue non débitée
      status: p.status === "rejected" ? ("late" as const) : dueStatus(p.status === "paid", p.due_date!, today),
      label: paymentLabel(p),
      supplier: p.suppliers?.name ?? "",
      amount: p.amount,
      href: paymentHref(p),
    })),
    ...(invoices.data ?? []).map((invoice) => ({
      date: invoice.legal_due_date!,
      kind: "invoice" as const,
      status: dueStatus(invoice.status === "paid", invoice.legal_due_date!, today),
      label: `Facture ${invoice.number}`,
      supplier: invoice.suppliers?.name ?? "",
      amount: invoice.status === "paid" ? invoice.amount_incl_tax : Math.max(toCents(invoice.amount_incl_tax) - toCents(invoice.amount_paid), 0) / 100,
      href: `/factures/${invoice.id}`,
    })),
    ...(guarantees.data ?? []).map((p) => ({
      date: p.guarantee_return_due!,
      kind: "guarantee" as const,
      status: dueStatus(false, p.guarantee_return_due!, today),
      label: paymentLabel(p),
      supplier: p.suppliers?.name ?? "",
      amount: p.amount,
      href: paymentHref(p),
    })),
  ];
  return events.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
}
