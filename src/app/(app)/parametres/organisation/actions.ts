"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { parseOrganizationSettings } from "@/lib/organizations/settings";
import { emailSchema, iceSchema, optionalAmountSchema, optionalText, requiredText } from "@/lib/validation";

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
  annual_revenue: optionalAmountSchema("Le chiffre d'affaires"),
  require_mfa: z.literal("on").optional(),
  amount_words_rectified: z.literal("on").optional(),
});

export async function updateOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(["admin"]);
  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const { require_mfa, amount_words_rectified, ...fields } = parsed.data;
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organization.organizationId)
    .single();
  const settings = {
    ...parseOrganizationSettings(current?.settings),
    require_mfa: require_mfa === "on",
    amount_words_rectified: amount_words_rectified === "on",
  };

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
