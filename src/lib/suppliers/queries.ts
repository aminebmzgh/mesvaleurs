import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "./schemas";

const LIST_LIMIT = 200;

/** Fournisseurs de l'organisation active avec leur solde, filtrés par la recherche. */
export async function listSuppliers({ search, archived = false }: { search?: string; archived?: boolean }) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const term = sanitizeSearch(search);

  let query = supabase
    .from("suppliers")
    .select("id, name, city, ice, payment_terms_days, is_active")
    .eq("organization_id", organization.organizationId)
    .eq("is_active", !archived)
    .order("name")
    .limit(LIST_LIMIT);
  if (term) {
    query = query.or(`name.ilike.%${term}%,payee_name.ilike.%${term}%,ice.ilike.%${term}%`);
  }

  const [suppliers, summaries] = await Promise.all([
    query,
    supabase
      .from("supplier_summaries")
      .select("id, open_invoice_count, amount_due, amount_in_circulation")
      .eq("organization_id", organization.organizationId),
  ]);
  if (suppliers.error || summaries.error) {
    throw new Error("Impossible de charger les fournisseurs.", { cause: suppliers.error ?? summaries.error });
  }

  const byId = new Map(summaries.data.map((summary) => [summary.id, summary]));
  return {
    suppliers: suppliers.data.map((supplier) => ({ ...supplier, summary: byId.get(supplier.id) })),
    truncated: suppliers.data.length === LIST_LIMIT,
  };
}

/** Fiche complète d'un fournisseur : informations, soldes, factures et paiements. */
export async function getSupplier(id: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;

  const [supplier, summary, invoices, payments] = await Promise.all([
    supabase.from("suppliers").select("*").eq("organization_id", orgId).eq("id", id).maybeSingle(),
    supabase.from("supplier_summaries").select("*").eq("organization_id", orgId).eq("id", id).maybeSingle(),
    supabase
      .from("invoices")
      .select("id, number, issue_date, amount_incl_tax, amount_paid, amount_cashed, legal_due_date, status")
      .eq("organization_id", orgId)
      .eq("supplier_id", id)
      .order("issue_date", { ascending: false }),
    supabase
      .from("payments")
      .select("id, type, status, number, amount, issue_date, due_date, debited_at, checkbooks ( number_width )")
      .eq("organization_id", orgId)
      .eq("supplier_id", id)
      .order("issue_date", { ascending: false })
      .order("number", { ascending: false }),
  ]);
  const error = supplier.error ?? summary.error ?? invoices.error ?? payments.error;
  if (error) {
    throw new Error("Impossible de charger le fournisseur.", { cause: error });
  }
  if (!supplier.data) {
    return null;
  }
  return {
    ...supplier.data,
    summary: summary.data,
    invoices: invoices.data ?? [],
    payments: payments.data ?? [],
  };
}
