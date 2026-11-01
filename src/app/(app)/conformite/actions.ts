"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { DECLARATION_ROLES } from "@/lib/auth/roles";
import { quarterLabel } from "@/lib/compliance/late-payments";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { optionalText } from "@/lib/validation";

const declarationSchema = z.object({
  year: z.coerce.number().int().min(2023).max(2100),
  quarter: z.coerce.number().int().min(1).max(4),
  declared_on: z.iso.date({ error: "Indiquez la date de dépôt." }),
  reference: optionalText(100),
});

/** Marque un trimestre comme déclaré : le rappel s'arrête. */
export async function declareQuarter(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(DECLARATION_ROLES);
  const parsed = declarationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("late_payment_declarations").insert({ organization_id: organization.organizationId, ...parsed.data });
  if (error) {
    return { error: error.code === "23505" ? "Ce trimestre est déjà marqué comme déclaré." : "Impossible d'enregistrer la déclaration." };
  }
  revalidatePath("/conformite");
  revalidatePath("/alertes");
  return { success: `Déclaration du ${quarterLabel(parsed.data)} enregistrée.` };
}

/** Annule le marquage « déclaré » (erreur de saisie). */
export async function undoDeclaration(id: string): Promise<{ error?: string }> {
  const organization = await requireRole(DECLARATION_ROLES);
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("late_payment_declarations")
    .delete({ count: "exact" })
    .eq("organization_id", organization.organizationId)
    .eq("id", id);
  if (error || !count) {
    return { error: "Impossible d'annuler la déclaration." };
  }
  revalidatePath("/conformite");
  revalidatePath("/alertes");
  return {};
}
