import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import type { InvoiceStatus } from "@/lib/labels";
import { sanitizeSearch } from "@/lib/suppliers/schemas";
import { createClient } from "@/lib/supabase/server";

const LIST_LIMIT = 300;
/** Durée de validité des liens de téléchargement des pièces jointes. */
const SIGNED_URL_SECONDS = 10 * 60;

export type InvoiceFilter = InvoiceStatus | "open" | "all";

export async function listInvoices({
  search,
  status = "open",
  supplierId,
}: {
  search?: string;
  status?: InvoiceFilter;
  supplierId?: string;
}) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const term = sanitizeSearch(search);

  let query = supabase
    .from("invoices")
    .select(
      "id, number, issue_date, legal_due_date, amount_incl_tax, amount_paid, amount_cashed, status, attachment_path, suppliers ( id, name )",
    )
    .eq("organization_id", organization.organizationId)
    .order("issue_date", { ascending: false })
    .order("number")
    .limit(LIST_LIMIT);
  if (status === "open") {
    query = query.in("status", ["unpaid", "partially_paid"]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }
  if (supplierId) {
    query = query.eq("supplier_id", supplierId);
  }
  if (term) {
    query = query.ilike("number", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Impossible de charger les factures.", { cause: error });
  }
  return { invoices: data, truncated: data.length === LIST_LIMIT };
}

/** Fournisseurs actifs, pour les listes déroulantes. */
export async function listSupplierOptions() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("organization_id", organization.organizationId)
    .eq("is_active", true)
    .order("name");
  if (error) {
    throw new Error("Impossible de charger les fournisseurs.", { cause: error });
  }
  return data.map((supplier) => ({ value: supplier.id, label: supplier.name }));
}

/** Détail d'une facture avec ses paiements et un lien temporaire vers sa pièce jointe. */
export async function getInvoice(id: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;

  const [invoice, allocations] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, suppliers ( id, name, payment_terms_days )")
      .eq("organization_id", orgId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("payment_allocations")
      .select(
        "id, amount, payments ( id, type, status, number, issue_date, due_date, debited_at, checkbooks ( number_width ) )",
      )
      .eq("organization_id", orgId)
      .eq("invoice_id", id),
  ]);
  if (invoice.error || allocations.error) {
    throw new Error("Impossible de charger la facture.", { cause: invoice.error ?? allocations.error });
  }
  if (!invoice.data) {
    return null;
  }

  let attachmentUrl: string | null = null;
  if (invoice.data.attachment_path) {
    const { data } = await supabase.storage
      .from("factures")
      .createSignedUrl(invoice.data.attachment_path, SIGNED_URL_SECONDS);
    attachmentUrl = data?.signedUrl ?? null;
  }

  return { ...invoice.data, allocations: allocations.data ?? [], attachmentUrl };
}
