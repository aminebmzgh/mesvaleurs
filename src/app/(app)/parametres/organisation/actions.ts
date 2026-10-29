"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { LOW_STOCK_CHOICES, parseOrganizationSettings, UNCASHED_ALERT_CHOICES } from "@/lib/organizations/settings";
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
  uncashed_alert_days: z.coerce.number().pipe(z.union(UNCASHED_ALERT_CHOICES.map((days) => z.literal(days)))),
  low_stock_threshold: z.coerce.number().pipe(z.union(LOW_STOCK_CHOICES.map((count) => z.literal(count)))),
  approval_threshold: optionalAmountSchema("Le seuil de validation"),
  daily_ceiling: optionalAmountSchema("Le plafond journalier"),
});

export async function updateOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(["admin"]);
  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const { require_mfa, amount_words_rectified, uncashed_alert_days, low_stock_threshold, approval_threshold, daily_ceiling, ...fields } =
    parsed.data;
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
    uncashed_alert_days,
    low_stock_threshold,
    // Un montant nul désactive la règle
    approval_threshold: approval_threshold || null,
    daily_ceiling: daily_ceiling || null,
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

/** Logo de l'entreprise (en-tête des lettres) : chemin du fichier envoyé dans le bucket `logos`, ou retrait. */
export async function setOrganizationLogo(path: string | null): Promise<{ error?: string }> {
  const organization = await requireRole(["admin"]);
  if (path !== null && !new RegExp(`^${organization.organizationId}/logo-[0-9a-f-]{36}\.(png|jpg)$`).test(path)) {
    return { error: "Fichier de logo invalide." };
  }
  const supabase = await createClient();
  const { data: current } = await supabase.from("organizations").select("logo_path").eq("id", organization.organizationId).single();
  const { error } = await supabase.from("organizations").update({ logo_path: path }).eq("id", organization.organizationId);
  if (error) {
    return { error: "Impossible d'enregistrer le logo." };
  }
  // L'ancien fichier n'est plus utilisé
  if (current?.logo_path && current.logo_path !== path) {
    await supabase.storage.from("logos").remove([current.logo_path]);
  }
  revalidatePath("/parametres/organisation");
  return {};
}
