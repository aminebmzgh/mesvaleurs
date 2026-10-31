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
  limit = LIST_LIMIT,
}: {
  search?: string;
  status?: InvoiceFilter;
  supplierId?: string;
  /** Nombre maximal de lignes (exports : davantage que l'écran). */
  limit?: number;
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
    .limit(limit);
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
  return { invoices: data, truncated: data.length === limit };
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

  const [invoice, allocations, archives] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, suppliers ( id, name, payment_terms_days )")
      .eq("organization_id", orgId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("payment_allocations")
      .select(
        "id, amount, payments ( id, type, status, number, reference, issue_date, due_date, debited_at, checkbooks ( number_width ) )",
      )
      .eq("organization_id", orgId)
      .eq("invoice_id", id),
    supabase
      .from("invoice_archives")
      .select("id, kind, archived_at, retain_until, sha256")
      .eq("organization_id", orgId)
      .eq("invoice_id", id)
      .order("archived_at"),
  ]);
  if (invoice.error || allocations.error || archives.error) {
    throw new Error("Impossible de charger la facture.", { cause: invoice.error ?? allocations.error ?? archives.error });
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

  return { ...invoice.data, allocations: allocations.data ?? [], archives: archives.data ?? [], attachmentUrl };
}

const ARCHIVE_LIMIT = 200;

/**
 * Registre des archives (archivage légal) : recherche par numéro de facture, raison
 * sociale ou ICE du fournisseur, et par date de facture ; liens temporaires vers les pièces.
 */
export async function listArchives({ search, from, to }: { search?: string; from?: string; to?: string }) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const term = sanitizeSearch(search);

  let invoiceIds: string[] | null = null;
  if (term || from || to) {
    let invoices = supabase.from("invoices").select("id").eq("organization_id", orgId).limit(2000);
    if (term) {
      // Numéro de facture, ou fournisseur retrouvé par sa raison sociale ou son ICE
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id")
        .eq("organization_id", orgId)
        .or(`name.ilike.%${term}%,ice.ilike.%${term}%`);
      const supplierIds = (suppliers ?? []).map((supplier) => supplier.id);
      invoices = invoices.or(
        supplierIds.length > 0 ? `number.ilike.%${term}%,supplier_id.in.(${supplierIds.join(",")})` : `number.ilike.%${term}%`,
      );
    }
    if (from) {
      invoices = invoices.gte("issue_date", from);
    }
    if (to) {
      invoices = invoices.lte("issue_date", to);
    }
    const { data, error } = await invoices;
    if (error) {
      throw new Error("Impossible de rechercher les archives.", { cause: error });
    }
    invoiceIds = data.map((invoice) => invoice.id);
  }

  let query = supabase
    .from("invoice_archives")
    .select(
      "id, kind, file_path, sha256, size_bytes, archived_at, retain_until, invoices ( id, number, issue_date, amount_incl_tax, suppliers ( name, ice ) )",
    )
    .eq("organization_id", orgId)
    .order("archived_at", { ascending: false })
    .limit(ARCHIVE_LIMIT);
  if (invoiceIds) {
    query = query.in("invoice_id", invoiceIds.length > 0 ? invoiceIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error("Impossible de charger les archives.", { cause: error });
  }
  const { data: urls } = data.length
    ? await supabase.storage.from("factures").createSignedUrls(
        data.map((archive) => archive.file_path),
        SIGNED_URL_SECONDS,
      )
    : { data: [] };
  const urlByPath = new Map((urls ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return {
    archives: data.map((archive) => ({ ...archive, url: urlByPath.get(archive.file_path) ?? null })),
    truncated: data.length === ARCHIVE_LIMIT,
  };
}
