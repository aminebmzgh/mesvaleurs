"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrganization } from "@/lib/auth/dal";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/** Récapitulatif quotidien par e-mail du membre connecté : activé ou non. */
export async function setEmailAlerts(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireActiveOrganization();
  const enabled = formData.get("enabled") === "on";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_email_alerts", { p_organization_id: organization.organizationId, p_enabled: enabled });
  if (error) {
    return { error: "Impossible d'enregistrer votre préférence." };
  }
  revalidatePath("/alertes");
  return { success: enabled ? "Vous recevrez le récapitulatif chaque matin." : "Vous ne recevrez plus le récapitulatif par e-mail." };
}
