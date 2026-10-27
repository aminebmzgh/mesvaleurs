"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { invoiceSchema, isAttachmentPathOf } from "@/lib/invoices/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

/** Rôles autorisés à supprimer une facture (comme la RLS). */
const DELETE_ROLES = ["admin", "manager"] as const;

function invoiceError(error: { code?: string; message?: string }): FormState {
  if (error.code === "23505") {
    return { fieldErrors: { number: ["Ce fournisseur a déjà une facture avec ce numéro."] } };
  }
  if (error.code === "P0001" && error.message) {
    return { error: error.message };
  }
  return { error: "Impossible d'enregistrer la facture. Vérifiez les informations saisies." };
}

export async function createInvoice(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .insert({ ...parsed.data, organization_id: organization.organizationId })
    .select("id")
    .single();
  if (error) {
    return invoiceError(error);
  }

  revalidatePath("/factures");
  redirect(`/factures/${data.id}`);
}

export async function updateInvoice(invoiceId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update(parsed.data)
    .eq("id", z.uuid().parse(invoiceId))
    .eq("organization_id", organization.organizationId);
  if (error) {
    return invoiceError(error);
  }

  revalidatePath("/factures", "layout");
  revalidatePath("/fournisseurs", "layout");
  return { success: "Facture enregistrée." };
}

/** Contester une facture (exclue des montants à payer), ou lever la contestation. */
export async function setInvoiceDisputed(invoiceId: string, disputed: boolean): Promise<ActionResult> {
  const organization = await requireRole(WRITER_ROLES);
  const supabase = await createClient();
  // Hors contestation, la base recalcule le statut à partir des paiements
  const { error } = await supabase
    .from("invoices")
    .update({ status: disputed ? "disputed" : "unpaid" })
    .eq("id", z.uuid().parse(invoiceId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/factures", "layout");
  return error ? { error: "Impossible de modifier la facture." } : {};
}

export async function deleteInvoice(invoiceId: string): Promise<ActionResult> {
  const organization = await requireRole([...DELETE_ROLES]);
  const id = z.uuid().parse(invoiceId);
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("attachment_path")
    .eq("id", id)
    .eq("organization_id", organization.organizationId)
    .maybeSingle();
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.organizationId);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Cette facture est rattachée à des paiements : elle ne peut pas être supprimée."
          : "Impossible de supprimer la facture.",
    };
  }
  if (invoice?.attachment_path) {
    await supabase.storage.from("factures").remove([invoice.attachment_path]);
  }

  revalidatePath("/factures", "layout");
  redirect("/factures");
}

/**
 * Enregistre la pièce jointe déposée par le navigateur dans Supabase Storage.
 * Le fichier ne transite pas par le serveur : seul son chemin est vérifié ici.
 */
export async function setInvoiceAttachment(invoiceId: string, path: string | null): Promise<ActionResult> {
  const organization = await requireRole(WRITER_ROLES);
  const id = z.uuid().parse(invoiceId);
  if (path !== null && !isAttachmentPathOf(path, organization.organizationId, id)) {
    return { error: "Pièce jointe invalide." };
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("attachment_path")
    .eq("id", id)
    .eq("organization_id", organization.organizationId)
    .maybeSingle();
  if (!invoice) {
    return { error: "Facture introuvable." };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ attachment_path: path })
    .eq("id", id)
    .eq("organization_id", organization.organizationId);
  if (error) {
    return { error: "Impossible d'enregistrer la pièce jointe." };
  }
  // L'ancien fichier, remplacé ou retiré, est supprimé du stockage
  if (invoice.attachment_path && invoice.attachment_path !== path) {
    await supabase.storage.from("factures").remove([invoice.attachment_path]);
  }

  revalidatePath(`/factures/${id}`);
  return {};
}
