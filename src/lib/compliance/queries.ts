import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { addDays, todayIso } from "@/lib/dates";
import { paymentNumber } from "@/lib/payments/label";
import { createClient } from "@/lib/supabase/server";
import { loadLegalParams } from "./data";
import {
  type ComplianceInvoice,
  complianceIndicators,
  declarationDeadline,
  declarationRequired,
  previousQuarter,
  type Quarter,
  quarterOf,
  quarterRange,
  quarterStatement,
} from "./late-payments";

const PAGE = 1000;
/** Ancienneté maximale (date limite légale) d'une facture soldée reprise dans un état. */
const LOOKBACK_DAYS = 730;

/** Factures utiles : non soldées, ou dont la date limite est récente (paiements du trimestre). */
async function loadInvoices(organizationId: string, since: string): Promise<ComplianceInvoice[]> {
  const supabase = await createClient();
  const invoices: ComplianceInvoice[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, number, issue_date, legal_due_date, amount_incl_tax, status, suppliers ( name, ice ), payment_allocations ( amount, payments ( type, status, number, reference, issue_date, delivered_at, due_date, debited_at, checkbooks ( number_width ) ) )",
      )
      .eq("organization_id", organizationId)
      .not("legal_due_date", "is", null)
      .or(`status.neq.paid,legal_due_date.gte.${since}`)
      .order("legal_due_date")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) {
      throw new Error("Impossible de charger les factures.");
    }
    for (const row of data ?? []) {
      invoices.push({
        id: row.id,
        number: row.number,
        issueDate: row.issue_date,
        legalDueDate: row.legal_due_date,
        amount: Number(row.amount_incl_tax),
        status: row.status,
        supplier: { name: row.suppliers?.name ?? "", ice: row.suppliers?.ice ?? null },
        allocations: (row.payment_allocations ?? []).flatMap((allocation) =>
          allocation.payments
            ? [
                {
                  amount: Number(allocation.amount),
                  payment: {
                    type: allocation.payments.type,
                    status: allocation.payments.status,
                    reference: paymentNumber(allocation.payments) || null,
                    issueDate: allocation.payments.issue_date,
                    deliveredAt: allocation.payments.delivered_at,
                    dueDate: allocation.payments.due_date,
                    debitedAt: allocation.payments.debited_at,
                  },
                },
              ]
            : [],
        ),
      });
    }
    if (!data || data.length < PAGE) {
      return invoices;
    }
  }
}

/**
 * Page Loi 69-21 : indicateurs du jour, état du trimestre choisi (par défaut le dernier
 * trimestre écoulé), date limite et état de sa déclaration.
 */
export async function getCompliance(requested: Quarter | null) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const today = todayIso();
  const quarter = requested ?? previousQuarter(quarterOf(today));
  const range = quarterRange(quarter);

  const [params, revenue, declarations, invoices] = await Promise.all([
    loadLegalParams(supabase),
    supabase.from("organizations").select("annual_revenue").eq("id", organization.organizationId).maybeSingle(),
    supabase
      .from("late_payment_declarations")
      .select("id, year, quarter, declared_on, reference")
      .eq("organization_id", organization.organizationId)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false }),
    loadInvoices(organization.organizationId, addDays(range.start, -LOOKBACK_DAYS)),
  ]);

  const basis = organization.latePaymentBasis;
  const rows = quarterStatement(invoices, quarter, basis, params);
  const annualRevenue = revenue.data?.annual_revenue ?? null;
  return {
    organization,
    today,
    quarter,
    range,
    params,
    basis,
    annualRevenue,
    required: declarationRequired(annualRevenue === null ? null : Number(annualRevenue), params),
    deadline: declarationDeadline(quarter, params),
    declaration: (declarations.data ?? []).find((d) => d.year === quarter.year && d.quarter === quarter.quarter) ?? null,
    indicators: complianceIndicators(invoices, today, organization.invoiceAlertDays, basis),
    rows,
    totals: {
      latePaid: rows.filter((row) => row.kind === "late_paid").reduce((sum, row) => sum + row.amount, 0),
      unpaid: rows.filter((row) => row.kind === "unpaid").reduce((sum, row) => sum + row.amount, 0),
      fines: Math.round(rows.reduce((sum, row) => sum + row.fine * 100, 0)) / 100,
    },
  };
}
