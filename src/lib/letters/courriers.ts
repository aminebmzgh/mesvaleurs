import "server-only";
import { toCents } from "@/lib/amount";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getLetterhead } from "./data";
import type { OppositionData, PostponementRequestData, StatementRequestData } from "./documents";
import { letterReference } from "./reference";

const supplierLines = (s: { address: string | null; city: string | null; ice: string | null }) =>
  [s.address, s.city, s.ice && `ICE ${s.ice}`].filter(Boolean) as string[];

/** Données de la lettre d'opposition d'une opposition enregistrée. */
export async function getOppositionData(stopOrderId: string): Promise<OppositionData | null> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const [letterhead, stop] = await Promise.all([
    getLetterhead(),
    supabase
      .from("stop_orders")
      .select(
        `reason, occurred_on, declared_on, police_report, first_number, last_number,
         checkbooks ( type, number_width ),
         bank_accounts ( label, branch, rib, banks ( name ) ),
         payments ( type, number, payee_name, amount, issue_date )`,
      )
      .eq("organization_id", organization.organizationId)
      .eq("id", stopOrderId)
      .maybeSingle(),
  ]);
  if (stop.error) {
    throw new Error("Impossible de préparer la lettre d'opposition.", { cause: stop.error });
  }
  const row = stop.data;
  if (!row?.checkbooks || !row.bank_accounts) {
    return null;
  }
  const payment = row.payments;
  return {
    ...letterhead,
    place: letterhead.organization.city ?? "",
    date: row.declared_on,
    reference: letterReference("OP", row.declared_on, row.first_number),
    bank: {
      name: row.bank_accounts.banks?.name ?? "",
      branch: row.bank_accounts.branch,
      accountLabel: row.bank_accounts.label,
      rib: row.bank_accounts.rib,
    },
    reason: row.reason,
    occurredOn: row.occurred_on,
    policeReport: row.police_report,
    instrument: row.checkbooks.type,
    numberWidth: row.checkbooks.number_width,
    payment:
      payment && payment.type !== "transfer" && payment.number != null
        ? { type: payment.type, number: payment.number, payee: payment.payee_name, amount: payment.amount, issueDate: payment.issue_date }
        : null,
    firstNumber: row.first_number,
    lastNumber: row.last_number,
  };
}

/** Données de la demande de prorogation d'une LCN en circulation. */
export async function getPostponementRequestData(
  paymentId: string,
  newDueDate: string,
  reason: string,
): Promise<PostponementRequestData | null> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const [letterhead, lcn] = await Promise.all([
    getLetterhead(),
    supabase
      .from("payments")
      .select("number, amount, due_date, checkbooks ( number_width ), bank_accounts ( banks ( name ) ), suppliers ( name, address, city, ice )")
      .eq("organization_id", organization.organizationId)
      .eq("id", paymentId)
      .eq("type", "lcn")
      .in("status", ["issued", "delivered"])
      .maybeSingle(),
  ]);
  if (lcn.error) {
    throw new Error("Impossible de préparer la demande de prorogation.", { cause: lcn.error });
  }
  const row = lcn.data;
  if (!row?.suppliers || row.number == null || !row.due_date) {
    return null;
  }
  const date = todayIso();
  return {
    ...letterhead,
    place: letterhead.organization.city ?? "",
    date,
    reference: letterReference("PR", date, row.number),
    supplier: { name: row.suppliers.name, lines: supplierLines(row.suppliers) },
    lcn: {
      number: row.number,
      numberWidth: row.checkbooks?.number_width ?? 7,
      amount: row.amount,
      bank: row.bank_accounts?.banks?.name ?? "",
      dueDate: row.due_date,
    },
    newDueDate,
    reason,
  };
}

/** Données de la demande de relevé de compte à un fournisseur, arrêtée au `asOf`. */
export async function getStatementRequestData(supplierId: string, asOf: string): Promise<StatementRequestData | null> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const [letterhead, supplier, invoices] = await Promise.all([
    getLetterhead(),
    supabase.from("suppliers").select("name, address, city, ice").eq("organization_id", orgId).eq("id", supplierId).maybeSingle(),
    supabase
      .from("invoices")
      .select("number, issue_date, amount_incl_tax, amount_paid")
      .eq("organization_id", orgId)
      .eq("supplier_id", supplierId)
      .in("status", ["unpaid", "partially_paid"])
      .lte("issue_date", asOf)
      .order("issue_date"),
  ]);
  if (supplier.error || invoices.error) {
    throw new Error("Impossible de préparer la demande de relevé.", { cause: supplier.error ?? invoices.error });
  }
  if (!supplier.data) {
    return null;
  }
  const date = todayIso();
  return {
    ...letterhead,
    place: letterhead.organization.city ?? "",
    date,
    reference: letterReference("RC", date),
    supplier: { name: supplier.data.name, lines: supplierLines(supplier.data) },
    asOf,
    invoices: (invoices.data ?? []).map((i) => ({
      number: i.number,
      issueDate: i.issue_date,
      amountInclTax: i.amount_incl_tax,
      remaining: Math.max(toCents(i.amount_incl_tax) - toCents(i.amount_paid), 0) / 100,
    })),
  };
}
