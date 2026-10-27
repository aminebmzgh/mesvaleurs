"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { findDefaultTemplate } from "@/lib/printing/default-templates";
import { isBackgroundPathOf, type TemplateInput, templateInputSchema } from "@/lib/printing/schemas";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

/** Crée un modèle de l'organisation à partir d'un modèle par défaut. */
export async function createTemplate(sourceKey: string) {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const source = findDefaultTemplate(sourceKey);
  if (!source) {
    redirect("/comptes-bancaires/modeles?erreur=modele");
  }
  const supabase = await createClient();
  const bank = source.bankShortName
    ? (await supabase.from("banks").select("id").eq("short_name", source.bankShortName).is("organization_id", null).maybeSingle()).data
    : null;

  const { data, error } = await supabase
    .from("print_templates")
    .insert({
      organization_id: organization.organizationId,
      bank_id: bank?.id ?? null,
      type: source.type,
      name: source.name,
      width_mm: source.widthMm,
      height_mm: source.heightMm,
      offset_x_mm: source.offsetXMm,
      offset_y_mm: source.offsetYMm,
      zones: source.zones,
      options: source.options,
      source_key: source.key,
    })
    .select("id")
    .single();
  if (error) {
    redirect("/comptes-bancaires/modeles?erreur=creation");
  }
  revalidatePath("/comptes-bancaires/modeles");
  redirect(`/comptes-bancaires/modeles/${data.id}`);
}

export async function saveTemplate(templateId: string, input: TemplateInput): Promise<ActionResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Modèle invalide." };
  }
  const t = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("print_templates")
    .update({
      name: t.name,
      width_mm: t.widthMm,
      height_mm: t.heightMm,
      offset_x_mm: t.offsetXMm,
      offset_y_mm: t.offsetYMm,
      zones: t.zones,
      options: t.options,
    })
    .eq("id", z.uuid().parse(templateId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/comptes-bancaires", "layout");
  return error ? { error: "Impossible d'enregistrer le modèle." } : {};
}

/** Enregistre le scan de fond déposé par le navigateur dans Supabase Storage. */
export async function setTemplateBackground(templateId: string, path: string | null): Promise<ActionResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const id = z.uuid().parse(templateId);
  if (path !== null && !isBackgroundPathOf(path, organization.organizationId, id)) {
    return { error: "Fichier invalide." };
  }
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("print_templates")
    .select("background_path")
    .eq("id", id)
    .eq("organization_id", organization.organizationId)
    .maybeSingle();
  if (!current) {
    return { error: "Modèle introuvable." };
  }
  const { error } = await supabase
    .from("print_templates")
    .update({ background_path: path })
    .eq("id", id)
    .eq("organization_id", organization.organizationId);
  if (error) {
    return { error: "Impossible d'enregistrer le scan." };
  }
  if (current.background_path && current.background_path !== path) {
    await supabase.storage.from("modeles-impression").remove([current.background_path]);
  }
  revalidatePath(`/comptes-bancaires/modeles/${id}`);
  return {};
}

export async function deleteTemplate(templateId: string): Promise<ActionResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const id = z.uuid().parse(templateId);
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("print_templates")
    .select("background_path")
    .eq("id", id)
    .eq("organization_id", organization.organizationId)
    .maybeSingle();
  // Les carnets qui l'utilisaient reviennent au modèle par défaut de leur banque
  const { error } = await supabase
    .from("print_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.organizationId);
  if (error) {
    return { error: "Impossible de supprimer le modèle." };
  }
  if (current?.background_path) {
    await supabase.storage.from("modeles-impression").remove([current.background_path]);
  }
  revalidatePath("/comptes-bancaires", "layout");
  redirect("/comptes-bancaires/modeles");
}

/** Modèle utilisé pour imprimer les formules d'un carnet (null : modèle par défaut). */
export async function setCheckbookTemplate(checkbookId: string, templateId: string | null): Promise<ActionResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("checkbooks")
    .update({ print_template_id: templateId ? z.uuid().parse(templateId) : null })
    .eq("id", z.uuid().parse(checkbookId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/comptes-bancaires", "layout");
  return error ? { error: "Impossible d'associer le modèle." } : {};
}
