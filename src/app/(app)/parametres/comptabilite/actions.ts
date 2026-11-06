"use server";

import { planError } from "@/lib/billing/guard";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { accountingExportSchema, parseOrganizationSettings } from "@/lib/organizations/settings";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const code = (label: string) =>
  z.string().trim().regex(/^[A-Za-z0-9._-]{1,20}$/, { error: `${label} : 1 à 20 caractères (lettres, chiffres, . _ -).` });

/** Saisie du formulaire : contrôlée strictement (les valeurs par défaut ne masquent pas une erreur). */
const formSchema = z.object({
  journal: code("Le journal"),
  supplierAccount: code("Le compte fournisseurs"),
  bankAccount: code("Le compte de banque"),
  billsAccount: code("Le compte d'effets à payer"),
  basis: z.enum(["debit", "issue"]),
  separator: z.enum([";", ",", "tab"]),
  dateFormat: z.enum(["dd/mm/yyyy", "yyyy-mm-dd", "ddmmyy"]),
  decimal: z.enum([",", "."]),
  header: z.literal("on").optional().transform((value) => value === "on"),
});

/** Paramètres de l'export comptable mensuel (administrateur). */
export async function updateAccountingExport(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(["admin"]);
  const blocked = planError(organization, "accounting_export");
  if (blocked) {
    return { error: blocked };
  }
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  const supabase = await createClient();
  const { data: current } = await supabase.from("organizations").select("settings").eq("id", organization.organizationId).single();
  const settings = { ...parseOrganizationSettings(current?.settings), accounting_export: accountingExportSchema.parse(parsed.data) };
  const { error } = await supabase.from("organizations").update({ settings }).eq("id", organization.organizationId);
  if (error) {
    return { error: "Impossible d'enregistrer les paramètres." };
  }
  revalidatePath("/parametres/comptabilite");
  return { success: "Paramètres de l'export comptable enregistrés." };
}
