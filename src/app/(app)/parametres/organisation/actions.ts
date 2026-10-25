"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, iceSchema, optionalText, requiredText } from "@/lib/validation";

const organizationSchema = z.object({
  name: requiredText("La raison sociale"),
  ice: iceSchema,
  tax_id: optionalText(30),
  trade_register: optionalText(60),
  patente: optionalText(30),
  cnss: optionalText(30),
  address: optionalText(300),
  city: optionalText(120),
  phone: optionalText(30),
  email: z.union([z.literal("").transform(() => null), emailSchema]).optional(),
  annual_revenue: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s ]/g, "").replace(",", "."))
    .refine((value) => value === "" || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0), {
      error: "Montant invalide (exemple : 1 250 000,00).",
    })
    .transform((value) => (value === "" ? null : Number(value)))
    .optional(),
  require_mfa: z.literal("on").optional(),
});

export async function updateOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(["admin"]);
  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const { require_mfa, ...fields } = parsed.data;
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organization.organizationId)
    .single();
  const settings = { ...((current?.settings as Record<string, unknown>) ?? {}), require_mfa: require_mfa === "on" };

  const { error } = await supabase
    .from("organizations")
    .update({ ...fields, settings })
    .eq("id", organization.organizationId);
  if (error) {
    return { error: "Impossible d'enregistrer les modifications. Vérifiez les informations saisies." };
  }

  revalidatePath("/", "layout");
  return { success: "Informations de l'entreprise enregistrées." };
}
