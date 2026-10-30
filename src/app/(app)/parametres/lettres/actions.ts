"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { LETTER_KINDS, letterTemplateSchema } from "@/lib/letters/schemas";
import { createClient } from "@/lib/supabase/server";

function templateError(error: { code?: string }): FormState {
  if (error.code === "23505") {
    return { fieldErrors: { name: ["Un modèle porte déjà ce nom."] } };
  }
  return { error: "Impossible d'enregistrer le modèle." };
}

export async function createLetterTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const kind = z.enum(LETTER_KINDS).safeParse(formData.get("kind"));
  const parsed = letterTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!kind.success) {
    return { error: "Type de courrier invalide." };
  }
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("letter_templates")
    .insert({ ...parsed.data, kind: kind.data, organization_id: organization.organizationId });
  if (error) {
    return templateError(error);
  }
  revalidatePath("/parametres/lettres");
  redirect("/parametres/lettres");
}

export async function updateLetterTemplate(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const parsed = letterTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("letter_templates")
    .update(parsed.data)
    .eq("id", z.uuid().parse(id))
    .eq("organization_id", organization.organizationId);
  if (error) {
    return templateError(error);
  }
  revalidatePath("/parametres/lettres");
  return { success: "Modèle enregistré." };
}

export async function deleteLetterTemplate(id: string): Promise<{ error?: string }> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("letter_templates")
    .delete()
    .eq("id", z.uuid().parse(id))
    .eq("organization_id", organization.organizationId);
  if (error) {
    return { error: "Impossible de supprimer le modèle." };
  }
  revalidatePath("/parametres/lettres");
  return {};
}
