import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import type { PaymentStatus, PaymentType } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const LIST_LIMIT = 300;

export type PaymentFilter = "circulation" | "all" | PaymentStatus;

const BASE_COLUMNS =
  "id, type, status, number, reference, amount, payee_name, issue_date, due_date, delivered_at, debited_at, cancellation_reason, rejected_at, rejection_kind, rejection_reason, regularization_due_date, regularized_at, regularization_method, print_batch_id, suppliers ( id, name ), checkbooks ( number_width )";
// Une relation ne peut être embarquée qu'une fois par requête (PostgREST, erreur 42712)
const PAYMENT_COLUMNS = `${BASE_COLUMNS}, bank_accounts ( label )`;

/** Chèques et LCN de l'organisation active, filtrés. */
export async function listPayments({
  status = "circulation",
  type,
  number,
}: {
  status?: PaymentFilter;
  type?: PaymentType;
  number?: number;
}) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("organization_id", organization.organizationId)
    .neq("status", "draft")
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(LIST_LIMIT);
  if (status === "circulation") {
    query = query.in("status", ["issued", "delivered"]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }
  if (type) {
    query = query.eq("type", type);
  }
  if (number !== undefined) {
    query = query.eq("number", number);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error("Impossible de charger les paiements.", { cause: error });
  }
  return { payments: data, truncated: data.length === LIST_LIMIT };
}

/** Lot émis par l'assistant, avec ses formules et les factures réglées. */
export async function getBatch(batchId: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const [batch, payments] = await Promise.all([
    supabase.from("print_batches").select("id, created_at, printed_at, print_count").eq("organization_id", orgId).eq("id", batchId).maybeSingle(),
    supabase
      .from("payments")
      .select(
        `${BASE_COLUMNS}, issue_place, bank_accounts ( label, banks ( name ) ), payment_allocations ( amount, invoices ( id, number ) )`,
      )
      .eq("organization_id", orgId)
      .eq("print_batch_id", batchId)
      .order("number"),
  ]);
  if (batch.error || payments.error) {
    throw new Error("Impossible de charger le lot.", { cause: batch.error ?? payments.error });
  }
  if (!batch.data) {
    return null;
  }
  return { ...batch.data, payments: payments.data ?? [] };
}
