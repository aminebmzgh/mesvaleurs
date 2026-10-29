import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { stockByAccount } from "@/lib/checkbooks";
import { paymentLabel, paymentNumber } from "@/lib/payments/label";
import { regularizationState } from "@/lib/payments/rejections";
import { addDays, daysBetween, todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/** Indicateurs du tableau de bord (spec §8), en une série de requêtes parallèles. */
export async function getDashboard() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const today = todayIso();
  const in30 = addDays(today, 30);

  const uncashedBefore = addDays(today, -organization.uncashedAlertDays);
  const [accounts, circulation, openInvoices, lcn, overdue, operations, checkbooks, rejected, guarantees, uncashed] = await Promise.all([
    supabase.from("bank_accounts").select("id, label, current_balance").eq("organization_id", orgId).eq("is_active", true),
    supabase
      .from("payments")
      .select("bank_account_id, amount")
      .eq("organization_id", orgId)
      .in("status", ["issued", "delivered"])
      .neq("type", "guarantee_check"),
    supabase.from("invoices").select("amount_incl_tax, amount_paid").eq("organization_id", orgId).in("status", ["unpaid", "partially_paid"]),
    supabase
      .from("payments")
      .select("id, number, reference, amount, due_date, suppliers ( name ), checkbooks ( number_width )")
      .eq("organization_id", orgId)
      .eq("type", "lcn")
      .in("status", ["issued", "delivered"])
      .lte("due_date", in30)
      .order("due_date"),
    supabase
      .from("invoices")
      .select("id, number, legal_due_date, amount_incl_tax, amount_paid, suppliers ( name )")
      .eq("organization_id", orgId)
      .in("status", ["unpaid", "partially_paid"])
      .lt("legal_due_date", today)
      .order("legal_due_date"),
    supabase
      .from("statement_lines")
      .select("id, operation_date, label, debit, credit, status, bank_accounts ( label )")
      .eq("organization_id", orgId)
      .order("operation_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("checkbook_summaries")
      .select("id, type, status, remaining_count, bank_account_id")
      .eq("organization_id", orgId)
      .eq("status", "active"),
    // Rejets non régularisés : alerte immédiate (loi 71-24)
    supabase
      .from("payments")
      .select("id, type, number, reference, amount, rejection_kind, regularized_at, regularization_due_date, suppliers ( name ), checkbooks ( number_width )")
      .eq("organization_id", orgId)
      .eq("status", "rejected")
      .is("regularized_at", null)
      .order("regularization_due_date", { nullsFirst: false }),
    // Chèques de garantie chez les fournisseurs : risque d'encaissement, rappels de restitution
    supabase
      .from("payments")
      .select("id, type, number, reference, amount, guarantee_return_due, guarantee_purpose, suppliers ( name ), checkbooks ( number_width )")
      .eq("organization_id", orgId)
      .eq("type", "guarantee_check")
      .in("status", ["issued", "delivered"])
      .order("guarantee_return_due"),
    // Chèques non encaissés au-delà du délai d'alerte de l'entreprise
    supabase
      .from("payments")
      .select("amount")
      .eq("organization_id", orgId)
      .eq("type", "check")
      .in("status", ["issued", "delivered"])
      .lte("issue_date", uncashedBefore),
  ]);
  const error = accounts.error ?? circulation.error ?? openInvoices.error ?? lcn.error ?? overdue.error ?? operations.error ?? checkbooks.error ?? rejected.error ?? guarantees.error ?? uncashed.error;
  if (error) {
    throw new Error("Impossible de charger le tableau de bord.", { cause: error });
  }

  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const circulationByAccount = new Map<string, number>();
  for (const payment of circulation.data ?? []) {
    circulationByAccount.set(payment.bank_account_id, (circulationByAccount.get(payment.bank_account_id) ?? 0) + payment.amount);
  }
  const accountRows = (accounts.data ?? []).map((account) => ({
    ...account,
    circulation: circulationByAccount.get(account.id) ?? 0,
    projected: account.current_balance - (circulationByAccount.get(account.id) ?? 0),
  }));
  const balance = sum(accountRows.map((a) => a.current_balance));
  const inCirculation = sum(accountRows.map((a) => a.circulation));

  return {
    today,
    balance,
    inCirculation,
    projected: balance - inCirculation,
    remaining: sum((openInvoices.data ?? []).map((i) => i.amount_incl_tax - i.amount_paid)),
    openInvoiceCount: openInvoices.data?.length ?? 0,
    // Provision insuffisante : solde − chèques et LCN en circulation < 0
    insufficientAccounts: accountRows.filter((a) => a.projected < 0),
    lcnDue: (lcn.data ?? []).map((payment) => ({
      id: payment.id,
      number: paymentNumber(payment),
      supplier: payment.suppliers?.name ?? "",
      amount: payment.amount,
      dueDate: payment.due_date!,
      daysLeft: daysBetween(today, payment.due_date!),
    })),
    overdue: (overdue.data ?? []).map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      supplier: invoice.suppliers?.name ?? "",
      remaining: invoice.amount_incl_tax - invoice.amount_paid,
      daysLate: daysBetween(invoice.legal_due_date!, today),
    })),
    operations: operations.data ?? [],
    rejected: (rejected.data ?? []).map((payment) => ({
      id: payment.id,
      label: paymentLabel(payment),
      supplier: payment.suppliers?.name ?? "",
      amount: payment.amount,
      kind: payment.rejection_kind,
      state: regularizationState(payment, today),
    })),
    uncashed: {
      days: organization.uncashedAlertDays,
      count: uncashed.data?.length ?? 0,
      total: sum((uncashed.data ?? []).map((p) => p.amount)),
    },
    guaranteeRisk: sum((guarantees.data ?? []).map((g) => g.amount)),
    guaranteeCount: guarantees.data?.length ?? 0,
    // Restitution prévue dans les 7 jours, ou dépassée
    guaranteesToRecover: (guarantees.data ?? [])
      .filter((g) => g.guarantee_return_due && g.guarantee_return_due <= addDays(today, 7))
      .map((g) => ({
        id: g.id,
        label: paymentLabel(g),
        supplier: g.suppliers?.name ?? "",
        amount: g.amount,
        purpose: g.guarantee_purpose,
        returnDue: g.guarantee_return_due!,
        daysLeft: daysBetween(today, g.guarantee_return_due!),
      })),
    // Comptes actifs dont le stock de formules (carnets en service) atteint le seuil
    lowStock: stockByAccount(
      (checkbooks.data ?? [])
        .filter((book) => accountRows.some((a) => a.id === book.bank_account_id))
        .map((book) => ({ bankAccountId: book.bank_account_id!, type: book.type!, status: book.status!, remaining: book.remaining_count ?? 0 })),
      organization.lowStockThreshold,
    )
      .filter((group) => group.low)
      .map((group) => ({
        id: `${group.bankAccountId}:${group.type}`,
        bankAccountId: group.bankAccountId,
        type: group.type,
        remaining: group.remaining,
        account: accountRows.find((a) => a.id === group.bankAccountId)?.label ?? "",
      })),
  };
}
