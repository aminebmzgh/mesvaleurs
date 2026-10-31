"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { sealInvoiceArchives } from "@/lib/invoices/archives";
import { isAttachmentPathOf } from "@/lib/invoices/schemas";
import { checkUbl, parseUbl, paymentTermsDays, UBL_MAX_BYTES, UblError, type UblParty } from "@/lib/invoices/ubl";
import { isValidRib } from "@/lib/rib";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type UblMatch = { supplier: { id: string; name: string } | null; duplicate: boolean };

/** Fournisseur du fichier : par son ICE, sinon par sa raison sociale exacte. */
async function findSupplier(supabase: Supabase, organizationId: string, party: Pick<UblParty, "ice" | "name">) {
  const query = supabase.from("suppliers").select("id, name").eq("organization_id", organizationId).limit(1);
  const { data } = party.ice ? await query.eq("ice", party.ice) : await query.ilike("name", party.name.replace(/[%_\\]/g, ""));
  return data?.[0] ?? null;
}

async function isDuplicate(supabase: Supabase, organizationId: string, supplierId: string, number: string) {
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("supplier_id", supplierId)
    .eq("number", number);
  return Boolean(count);
}

async function organizationIce(supabase: Supabase, organizationId: string) {
  const { data } = await supabase.from("organizations").select("ice").eq("id", organizationId).maybeSingle();
  return data?.ice ?? null;
}

const matchSchema = z
  .array(z.object({ ice: z.string().regex(/^\d{15}$/).nullable(), name: z.string().min(1).max(200), number: z.string().min(1).max(60) }))
  .max(50);

/** Aperçu : fournisseur reconnu et doublon, pour l'écran de vérification. */
export async function matchUbl(entries: z.infer<typeof matchSchema>): Promise<{ matches?: UblMatch[]; organizationIce?: string | null; error?: string }> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = matchSchema.safeParse(entries);
  if (!parsed.success) {
    return { error: "Fichiers invalides." };
  }
  const supabase = await createClient();
  const matches = await Promise.all(
    parsed.data.map(async (entry) => {
      const supplier = await findSupplier(supabase, organization.organizationId, entry);
      return { supplier, duplicate: supplier ? await isDuplicate(supabase, organization.organizationId, supplier.id, entry.number) : false };
    }),
  );
  return { matches, organizationIce: await organizationIce(supabase, organization.organizationId) };
}

const importSchema = z.object({ invoiceId: z.uuid(), path: z.string().max(300), createSupplier: z.boolean() });

/**
 * Crée la facture à partir du fichier UBL déposé par le navigateur : le fichier est relu
 * et contrôlé ici, depuis le stockage. Il devient la pièce de la facture, archivée 10 ans.
 */
export async function importUbl(input: z.infer<typeof importSchema>): Promise<{ invoiceId?: string; error?: string }> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = importSchema.safeParse(input);
  if (!parsed.success || !isAttachmentPathOf(parsed.data.path, organization.organizationId, parsed.data.invoiceId) || !parsed.data.path.endsWith(".xml")) {
    return { error: "Fichier invalide." };
  }
  const { invoiceId, path, createSupplier } = parsed.data;
  const orgId = organization.organizationId;
  const supabase = await createClient();
  // Fichier non retenu (pas encore archivé) : retiré du stockage
  const discard = async (error: string) => {
    await createAdminClient().storage.from("factures").remove([path]);
    return { error };
  };

  const { data: file } = await supabase.storage.from("factures").download(path);
  if (!file || file.size > UBL_MAX_BYTES) {
    return discard("Fichier introuvable ou trop volumineux.");
  }
  let invoice;
  try {
    invoice = parseUbl(await file.text());
  } catch (error) {
    return discard(error instanceof UblError ? error.message : "Fichier UBL illisible.");
  }

  let supplier = await findSupplier(supabase, orgId, invoice.supplier);
  const checks = checkUbl(invoice, {
    organizationIce: await organizationIce(supabase, orgId),
    duplicate: supplier ? await isDuplicate(supabase, orgId, supplier.id, invoice.number) : false,
  });
  const blocking = checks.find((check) => check.level === "error");
  if (blocking) {
    return discard(blocking.message);
  }
  if (!supplier) {
    if (!createSupplier) {
      return discard(`Fournisseur ${invoice.supplier.name} inconnu : confirmez sa création.`);
    }
    const party = invoice.supplier;
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        organization_id: orgId,
        name: party.name,
        ice: party.ice,
        tax_id: party.taxId,
        trade_register: party.tradeRegister,
        address: party.address,
        city: party.city,
        rib: party.rib && isValidRib(party.rib) ? party.rib : null,
        notes: "Créé à l'import d'une facture électronique UBL.",
      })
      .select("id, name")
      .single();
    if (error) {
      return discard(error.code === "23505" ? "Un fournisseur avec cet ICE existe déjà." : "Impossible de créer le fournisseur.");
    }
    supplier = data;
  }

  const { error } = await supabase.from("invoices").insert({
    id: invoiceId,
    organization_id: orgId,
    supplier_id: supplier.id,
    number: invoice.number,
    issue_date: invoice.issueDate,
    amount_excl_tax: invoice.amountExclTax,
    vat_amount: invoice.vatAmount,
    amount_incl_tax: invoice.amountInclTax,
    payment_terms_days: paymentTermsDays(invoice),
    attachment_path: path,
    notes: "Importée d'une facture électronique UBL.",
  });
  if (error) {
    return discard(error.code === "23505" ? `Facture ${invoice.number} déjà enregistrée pour ce fournisseur.` : "Impossible d'enregistrer la facture.");
  }
  await sealInvoiceArchives(orgId, invoiceId);

  revalidatePath("/factures", "layout");
  revalidatePath("/fournisseurs", "layout");
  return { invoiceId };
}
