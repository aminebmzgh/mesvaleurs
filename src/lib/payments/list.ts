import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { addDays, todayIso } from "@/lib/dates";
import type { PaymentStatus, PaymentType } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const LIST_LIMIT = 300;

export type PaymentFilter = "circulation" | "all" | PaymentStatus;

const BASE_COLUMNS =
  "id, type, status, number, reference, amount, payee_name, issue_date, due_date, delivered_at, debited_at, cancellation_reason, rejected_at, rejection_kind, rejection_reason, regularization_due_date, regularized_at, regularization_method, guarantee_purpose, guarantee_return_due, print_batch_id, lcn_postponements ( previous_due_date, created_at ), stop_orders ( id, reason, occurred_on ), suppliers ( id, name ), checkbooks ( number_width )";
// Une relation ne peut être embarquée qu'une fois par requête (PostgREST, erreur 42712)
const PAYMENT_COLUMNS = `${BASE_COLUMNS}, bank_accounts ( label )`;

/** Chèques et LCN de l'organisation active, filtrés. */
export async function listPayments({
  status = "circulation",
  type,
  number,
  limit = LIST_LIMIT,
}: {
  status?: PaymentFilter;
  type?: PaymentType;
  number?: number;
  /** Nombre maximal de lignes (exports : davantage que l'écran). */
  limit?: number;
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
    .limit(limit);
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
  return { payments: data, truncated: data.length === limit };
}

/** Lot émis par l'assistant, avec ses formules et les factures réglées. */
export async function getBatch(batchId: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const [batch, payments] = await Promise.all([
    supabase
      .from("print_batches")
      .select("id, created_at, printed_at, print_count, approval_status, approval_reasons, created_by, decided_by, decided_at, refusal_reason")
      .eq("organization_id", orgId)
      .eq("id", batchId)
      .maybeSingle(),
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
  const names = await profileNames([batch.data.created_by, batch.data.decided_by]);
  return {
    ...batch.data,
    preparedByName: batch.data.created_by ? (names.get(batch.data.created_by) ?? null) : null,
    decidedByName: batch.data.decided_by ? (names.get(batch.data.decided_by) ?? null) : null,
    payments: payments.data ?? [],
  };
}

/** Noms des membres (profils visibles de l'organisation), par identifiant. */
async function profileNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (wanted.length === 0) {
    return new Map();
  }
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", wanted);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || p.email]));
}

/** Lots en attente de validation (double signature), les plus anciens d'abord. */
export async function listPendingBatches() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("print_batches")
    .select(
      "id, created_at, created_by, approval_reasons, payments ( id, type, number, amount, issue_date, suppliers ( name ), bank_accounts ( label ), checkbooks ( number_width ) )",
    )
    .eq("organization_id", organization.organizationId)
    .eq("approval_status", "pending")
    .order("created_at")
    .limit(LIST_LIMIT);
  if (error) {
    throw new Error("Impossible de charger les lots à valider.", { cause: error });
  }
  const names = await profileNames(data.map((b) => b.created_by));
  return data.map((batch) => ({ ...batch, preparedByName: batch.created_by ? (names.get(batch.created_by) ?? null) : null }));
}

/**
 * Chèques émis et non encaissés depuis plus de `days` jours (spec §11 bis F), les plus
 * anciens d'abord, avec le contact du fournisseur pour la relance.
 */
export async function listUncashedChecks(days: number) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, type, status, number, reference, amount, issue_date, delivered_at, checkbooks ( number_width ), bank_accounts ( label ), suppliers ( id, name, contact_name, email, phone )",
    )
    .eq("organization_id", organization.organizationId)
    .eq("type", "check")
    .in("status", ["issued", "delivered"])
    .lte("issue_date", addDays(todayIso(), -days))
    .order("issue_date")
    .limit(LIST_LIMIT);
  if (error) {
    throw new Error("Impossible de charger les chèques non encaissés.", { cause: error });
  }
  return data;
}
