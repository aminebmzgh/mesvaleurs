"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { invoiceImportRowSchema, supplierNameKey } from "@/lib/invoices/import";
import { createClient } from "@/lib/supabase/server";

const MAX_ROWS = 2000;

const requestSchema = z.object({
  rows: z.array(invoiceImportRowSchema).min(1, { error: "Aucune facture à importer." }).max(MAX_ROWS, {
    error: `${MAX_ROWS} factures au maximum par import.`,
  }),
  createMissingSuppliers: z.boolean(),
});

export type InvoiceImportReport = {
  inserted: number;
  alreadyPresent: number;
  createdSuppliers: number;
  unknownSuppliers: { line: number; supplier: string }[];
};

type Result = { ok: true; data: InvoiceImportReport } | { ok: false; error: string };

/**
 * Import de factures : le fournisseur est reconnu par son ICE, sinon par sa raison
 * sociale (casse, accents et forme juridique ignorés). Les fournisseurs inconnus sont
 * créés si demandé ; les factures déjà saisies (même fournisseur et numéro) sont ignorées.
 */
export async function importInvoices(request: z.infer<typeof requestSchema>): Promise<Result> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = requestSchema.safeParse(request);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Import invalide." };
  }
  const { rows, createMissingSuppliers } = parsed.data;
  const orgId = organization.organizationId;
  const supabase = await createClient();

  const { data: suppliers, error } = await supabase.from("suppliers").select("id, name, ice").eq("organization_id", orgId);
  if (error) {
    return { ok: false, error: "Impossible de charger les fournisseurs." };
  }
  const byIce = new Map(suppliers.filter((s) => s.ice).map((s) => [s.ice!, s.id]));
  const byName = new Map<string, string | null>();
  for (const supplier of suppliers) {
    const key = supplierNameKey(supplier.name);
    // Deux fournisseurs de même nom : ambigu, on ne choisit pas
    byName.set(key, byName.has(key) ? null : supplier.id);
  }
  const resolve = (row: (typeof rows)[number]) =>
    (row.supplierIce ? byIce.get(row.supplierIce) : undefined) ?? byName.get(supplierNameKey(row.supplierName)) ?? null;

  // Fournisseurs inconnus : créés une seule fois chacun, si demandé
  let createdSuppliers = 0;
  const unknownSuppliers: InvoiceImportReport["unknownSuppliers"] = [];
  const missing = rows.filter((row) => !resolve(row));
  if (missing.length > 0 && createMissingSuppliers) {
    const toCreate = new Map<string, { name: string; ice: string | null }>();
    for (const row of missing) {
      const key = row.supplierIce ?? supplierNameKey(row.supplierName);
      if (!toCreate.has(key) && row.supplierName) {
        toCreate.set(key, { name: row.supplierName, ice: row.supplierIce });
      }
    }
    const { data: created, error: createError } = await supabase
      .from("suppliers")
      .insert([...toCreate.values()].map((s) => ({ organization_id: orgId, name: s.name, ice: s.ice })))
      .select("id, name, ice");
    if (createError) {
      return { ok: false, error: "Impossible de créer les fournisseurs manquants." };
    }
    for (const supplier of created ?? []) {
      if (supplier.ice) {
        byIce.set(supplier.ice, supplier.id);
      }
      byName.set(supplierNameKey(supplier.name), supplier.id);
    }
    createdSuppliers = created?.length ?? 0;
  }

  const invoices = rows.flatMap((row) => {
    const supplierId = resolve(row);
    if (!supplierId) {
      unknownSuppliers.push({ line: row.line, supplier: row.supplierName || row.supplierIce || "" });
      return [];
    }
    return [
      {
        organization_id: orgId,
        supplier_id: supplierId,
        number: row.number,
        issue_date: row.issueDate,
        amount_excl_tax: row.amountExclTax,
        vat_amount: row.vatAmount,
        amount_incl_tax: row.amountInclTax,
        payment_terms_days: row.paymentTermsDays,
      },
    ];
  });

  let inserted = 0;
  if (invoices.length > 0) {
    const { data, error: insertError } = await supabase
      .from("invoices")
      .upsert(invoices, { onConflict: "organization_id,supplier_id,number", ignoreDuplicates: true })
      .select("id");
    if (insertError) {
      return { ok: false, error: "Impossible d'enregistrer les factures." };
    }
    inserted = data?.length ?? 0;
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    data: { inserted, alreadyPresent: invoices.length - inserted, createdSuppliers, unknownSuppliers },
  };
}
