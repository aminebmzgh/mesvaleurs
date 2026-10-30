"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES, WRITER_ROLES } from "@/lib/auth/roles";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { parseCeiling } from "@/lib/payments/approvals";
import { supplierSchema } from "@/lib/suppliers/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

function supplierError(error: { code?: string; message?: string }): FormState {
  if (error.code === "23505") {
    return { fieldErrors: { ice: ["Un fournisseur avec cet ICE existe déjà dans votre entreprise."] } };
  }
  return { error: "Impossible d'enregistrer le fournisseur. Vérifiez les informations saisies." };
}

export async function createSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...parsed.data, organization_id: organization.organizationId })
    .select("id")
    .single();
  if (error) {
    return supplierError(error);
  }

  revalidatePath("/fournisseurs");
  redirect(`/fournisseurs/${data.id}`);
}

export async function updateSupplier(supplierId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update(parsed.data)
    .eq("id", z.uuid().parse(supplierId))
    .eq("organization_id", organization.organizationId);
  if (error) {
    return supplierError(error);
  }

  revalidatePath("/fournisseurs", "layout");
  return { success: "Fournisseur enregistré." };
}

export async function setSupplierActive(supplierId: string, isActive: boolean): Promise<ActionResult> {
  const organization = await requireRole(WRITER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: isActive })
    .eq("id", z.uuid().parse(supplierId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/fournisseurs", "layout");
  return error ? { error: "Impossible de modifier le fournisseur." } : {};
}

/** Plafond journalier d'un fournisseur (double signature), réservé aux gestionnaires et administrateurs. */
export async function setSupplierCeiling(supplierId: string, amount: string): Promise<ActionResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const ceiling = parseCeiling(amount);
  if (ceiling === undefined) {
    return { error: "Plafond invalide (exemple : 50 000,00)." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ daily_ceiling: ceiling })
    .eq("id", z.uuid().parse(supplierId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/fournisseurs", "layout");
  return error ? { error: "Impossible d'enregistrer le plafond." } : {};
}
