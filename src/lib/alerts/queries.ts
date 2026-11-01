import "server-only";
import { requireActiveOrganization, requireUser } from "@/lib/auth/dal";
import { loadDeclarationReminder } from "@/lib/compliance/data";
import { getDashboard } from "@/lib/dashboard/queries";
import { emailConfig } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";
import { buildAlerts } from "./alerts";

/** Alertes de l'entreprise active, telles que le récapitulatif quotidien les envoie. */
export async function getAlerts() {
  const organization = await requireActiveOrganization();
  const dashboard = await getDashboard();
  const declaration = await loadDeclarationReminder(await createClient(), organization.organizationId, organization.declarationReminderDays, dashboard.today);
  return buildAlerts(dashboard, { lcnAlertDays: organization.lcnAlertDays, declaration });
}

/** Préférence du membre connecté et derniers récapitulatifs envoyés à l'entreprise. */
export async function getEmailAlertSettings() {
  const organization = await requireActiveOrganization();
  const user = await requireUser();
  const supabase = await createClient();
  const [membership, digests] = await Promise.all([
    supabase.from("memberships").select("email_alerts, email_monthly_summary").eq("organization_id", organization.organizationId).eq("user_id", user.id).single(),
    supabase
      .from("alert_digests")
      .select("id, digest_date, status, alert_count, recipient_count")
      .eq("organization_id", organization.organizationId)
      .order("digest_date", { ascending: false })
      .limit(7),
  ]);
  const error = membership.error ?? digests.error;
  if (error) {
    throw new Error("Impossible de charger les préférences d'alerte.", { cause: error });
  }
  return {
    enabled: membership.data?.email_alerts ?? false,
    monthlySummary: membership.data?.email_monthly_summary ?? false,
    // Envoi configuré sur ce déploiement (clé Resend et expéditeur)
    sendingConfigured: emailConfig() !== null,
    // L'expert-comptable externe ne reçoit pas le récapitulatif
    eligible: organization.role !== "external_accountant",
    digests: digests.data ?? [],
  };
}
