"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrganization } from "@/lib/auth/dal";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/** E-mails du membre connecté : récapitulatif quotidien des alertes et résumé mensuel. */
export async function setEmailAlerts(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireActiveOrganization();
  const enabled = formData.get("enabled") === "on";
  const monthly = formData.get("monthly_summary") === "on";
  const supabase = await createClient();
  const [alerts, summary] = await Promise.all([
    supabase.rpc("set_email_alerts", { p_organization_id: organization.organizationId, p_enabled: enabled }),
    supabase.rpc("set_email_monthly_summary", { p_organization_id: organization.organizationId, p_enabled: monthly }),
  ]);
  if (alerts.error || summary.error) {
    return { error: "Impossible d'enregistrer vos préférences." };
  }
  revalidatePath("/alertes");
  return { success: "Préférences d'e-mail enregistrées." };
}
