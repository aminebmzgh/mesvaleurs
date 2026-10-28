import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { formatInstrumentNumber } from "@/lib/checkbooks";
import { daysBetween, todayIso } from "@/lib/dates";
import { paymentLabel } from "@/lib/payments/label";
import { createClient } from "@/lib/supabase/server";
import { ageBucket, missingNumbers, monthLabel, monthRange } from "./period";

export type PaidPayment = {
  id: string;
  instrument: string;
  amount: number;
  issueDate: string;
  debitedAt: string;
  account: string;
  invoices: { number: string; amount: number }[];
};

export type MonthlyReport = {
  month: string;
  label: string;
  organizationName: string;
  accountLabel: string | null;
  generatedOn: string;
  paid: { supplier: string; total: number; payments: PaidPayment[] }[];
  paidTotal: number;
  circulation: {
    id: string;
    instrument: string;
    supplier: string;
    account: string;
    amount: number;
    issueDate: string;
    dueDate: string | null;
    delivered: boolean;
    ageDays: number;
    bucket: ReturnType<typeof ageBucket>;
  }[];
  circulationTotal: number;
  anomalies: {
    amountMismatches: { date: string; label: string; lineAmount: number; instrument: string; paymentAmount: number; confirmed: boolean }[];
    unknownDebits: { date: string; label: string; number: number; amount: number }[];
    missingNumbers: { checkbook: string; numbers: string[] }[];
    cancelled: { instrument: string; supplier: string; amount: number; reason: string }[];
  };
};


/**
 * Rapport de fin de mois (spec §7.3) : chèques et LCN débités dans le mois, groupés par
 * fournisseur et facture ; paiements en circulation et leur ancienneté ; anomalies.
 */
export async function getMonthlyReport(month: string, accountId?: string): Promise<MonthlyReport> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const { start, end } = monthRange(month);
  const today = todayIso();
  // Ancienneté des paiements en circulation : au jour du rapport, ou en fin de mois passé
  const asOf = end < today ? end : today;

  const byAccount = <T extends { eq: (column: string, value: string) => T }>(query: T, column = "bank_account_id") =>
    accountId ? query.eq(column, accountId) : query;

  const [org, account, paid, circulation, lines, cancelled, checkbooks] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).single(),
    accountId ? supabase.from("bank_accounts").select("label").eq("organization_id", orgId).eq("id", accountId).maybeSingle() : null,
    byAccount(
      supabase
        .from("payments")
        .select(
          "id, type, number, reference, amount, issue_date, debited_at, suppliers ( name ), checkbooks ( number_width ), bank_accounts ( label ), payment_allocations ( amount, invoices ( number ) )",
        )
        .eq("organization_id", orgId)
        .eq("status", "paid")
        .gte("debited_at", start)
        .lte("debited_at", end),
    ).order("debited_at"),
    byAccount(
      supabase
        .from("payments")
        .select("id, type, number, reference, amount, issue_date, due_date, delivered_at, status, suppliers ( name ), checkbooks ( number_width ), bank_accounts ( label )")
        .eq("organization_id", orgId)
        .in("status", ["issued", "delivered"])
        .lte("issue_date", end),
    ).order("issue_date"),
    byAccount(
      supabase
        .from("statement_lines")
        .select(
          "operation_date, label, debit, extracted_number, status, payments!statement_lines_organization_id_matched_payment_id_fkey ( type, number, reference, amount, checkbooks ( number_width ) )",
        )
        .eq("organization_id", orgId)
        .gte("operation_date", start)
        .lte("operation_date", end)
        .gt("debit", 0),
    ).order("operation_date"),
    byAccount(
      supabase
        .from("payments")
        .select("type, number, reference, amount, cancellation_reason, suppliers ( name ), checkbooks ( number_width )")
        .eq("organization_id", orgId)
        .eq("status", "cancelled")
        .gte("cancelled_at", `${start}T00:00:00Z`)
        .lte("cancelled_at", `${end}T23:59:59Z`),
    ),
    byAccount(
      supabase
        .from("checkbooks")
        .select("id, type, first_number, next_number, number_width, bank_accounts ( label )")
        .eq("organization_id", orgId),
    ),
  ]);
  const error = org.error ?? paid.error ?? circulation.error ?? lines.error ?? cancelled.error ?? checkbooks.error;
  if (error) {
    throw new Error("Impossible de construire le rapport.", { cause: error });
  }

  // Débités du mois, groupés par fournisseur
  const groups = new Map<string, { supplier: string; total: number; payments: PaidPayment[] }>();
  for (const payment of paid.data ?? []) {
    const supplier = payment.suppliers?.name ?? "—";
    const group = groups.get(supplier) ?? { supplier, total: 0, payments: [] };
    group.total += payment.amount;
    group.payments.push({
      id: payment.id,
      instrument: paymentLabel(payment),
      amount: payment.amount,
      issueDate: payment.issue_date,
      debitedAt: payment.debited_at!,
      account: payment.bank_accounts?.label ?? "",
      invoices: payment.payment_allocations.flatMap((a) => (a.invoices ? [{ number: a.invoices.number, amount: a.amount }] : [])),
    });
    groups.set(supplier, group);
  }
  const paidGroups = [...groups.values()].sort((a, b) => b.total - a.total);

  // Numéros sautés : attribuables (avant le prochain numéro) mais absents des paiements
  const { data: usedNumbers } = await supabase
    .from("payments")
    .select("checkbook_id, number")
    .eq("organization_id", orgId)
    .in("checkbook_id", (checkbooks.data ?? []).map((c) => c.id))
    .not("number", "is", null);
  const missing = (checkbooks.data ?? []).flatMap((book) => {
    const numbers = missingNumbers(
      book.first_number,
      book.next_number,
      (usedNumbers ?? []).filter((p) => p.checkbook_id === book.id).map((p) => p.number!),
    );
    return numbers.length > 0
      ? [
          {
            checkbook: `${book.type === "lcn" ? "Carnet de LCN" : "Chéquier"} ${book.bank_accounts?.label ?? ""}`.trim(),
            numbers: numbers.map((n) => formatInstrumentNumber(n, book.number_width)),
          },
        ]
      : [];
  });

  const circulationRows = (circulation.data ?? []).map((payment) => {
    const ageDays = Math.max(daysBetween(payment.delivered_at ?? payment.issue_date, asOf), 0);
    return {
      id: payment.id,
      instrument: paymentLabel(payment),
      supplier: payment.suppliers?.name ?? "—",
      account: payment.bank_accounts?.label ?? "",
      amount: payment.amount,
      issueDate: payment.issue_date,
      dueDate: payment.due_date,
      delivered: payment.status === "delivered",
      ageDays,
      bucket: ageBucket(ageDays),
    };
  });

  return {
    month,
    label: monthLabel(month),
    organizationName: org.data?.name ?? "",
    accountLabel: account?.data?.label ?? null,
    generatedOn: today,
    paid: paidGroups,
    paidTotal: paidGroups.reduce((sum, group) => sum + group.total, 0),
    circulation: circulationRows,
    circulationTotal: circulationRows.reduce((sum, row) => sum + row.amount, 0),
    anomalies: {
      amountMismatches: (lines.data ?? []).flatMap((line) =>
        line.payments && Math.round(line.payments.amount * 100) !== Math.round((line.debit ?? 0) * 100)
          ? [
              {
                date: line.operation_date,
                label: line.label,
                lineAmount: line.debit ?? 0,
                instrument: paymentLabel(line.payments),
                paymentAmount: line.payments.amount,
                confirmed: line.status === "auto_matched" || line.status === "manually_matched",
              },
            ]
          : [],
      ),
      unknownDebits: (lines.data ?? []).flatMap((line) =>
        line.status === "unmatched" && line.extracted_number != null
          ? [{ date: line.operation_date, label: line.label, number: line.extracted_number, amount: line.debit ?? 0 }]
          : [],
      ),
      missingNumbers: missing,
      cancelled: (cancelled.data ?? []).map((payment) => ({
        instrument: paymentLabel(payment),
        supplier: payment.suppliers?.name ?? "—",
        amount: payment.amount,
        reason: payment.cancellation_reason ?? "",
      })),
    },
  };
}
