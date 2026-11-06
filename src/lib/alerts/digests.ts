import { effectivePlan, hasFeature } from "@/lib/billing/plans";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDeclarationReminder } from "@/lib/compliance/data";
import { loadDashboard } from "@/lib/dashboard/queries";
import { type EmailMessage, sendEmails } from "@/lib/email/send";
import { parseOrganizationSettings } from "@/lib/organizations/settings";
import type { Database } from "@/types/database";
import { buildAlerts } from "./alerts";
import { digestEmail } from "./digest";

type DigestStatus = Database["public"]["Enums"]["alert_digest_status"];

export type DigestOutcome = { organizationId: string; status: DigestStatus | "skipped"; alerts: number; recipients: number };

/** Rôles destinataires du récapitulatif (l'expert-comptable externe n'en reçoit pas). */
const RECIPIENT_ROLES = ["admin", "manager", "preparer", "accountant"] as const;

/**
 * Récapitulatif quotidien des alertes de chaque entreprise (tâche planifiée, client
 * service_role). Une entreprise déjà traitée ce jour est ignorée ; un envoi échoué
 * est retenté.
 */
export async function runDailyDigests({
  admin,
  today,
  appName,
  siteUrl,
  send = sendEmails,
}: {
  admin: SupabaseClient<Database>;
  today: string;
  appName: string;
  siteUrl: string;
  send?: typeof sendEmails;
}): Promise<DigestOutcome[]> {
  const { data: organizations, error } = await admin.from("organizations").select("id, name, settings, subscriptions ( plan, trial_ends_at )").order("created_at");
  if (error) {
    throw new Error("Impossible de lire les entreprises.", { cause: error });
  }

  const outcomes: DigestOutcome[] = [];
  // Récapitulatif par e-mail : offres Pro et supérieures
  for (const organization of organizations.filter((row) => hasFeature(effectivePlan(row.subscriptions), "alert_emails"))) {
    // Une entreprise en erreur n'empêche pas l'envoi aux suivantes
    let outcome: DigestOutcome;
    try {
      outcome = (await claimDigest(admin, organization.id, today))
        ? await digestFor(admin, organization, { today, appName, siteUrl, send })
        : { organizationId: organization.id, status: "skipped", alerts: 0, recipients: 0 };
    } catch (cause) {
      outcome = { organizationId: organization.id, status: "failed", alerts: 0, recipients: 0 };
      await finishDigest(admin, organization.id, today, outcome, cause instanceof Error ? cause.message : String(cause));
    }
    outcomes.push(outcome);
  }
  return outcomes;
}

/** Réserve l'envoi du jour : nouvelle ligne, ou reprise d'un envoi échoué. */
async function claimDigest(admin: SupabaseClient<Database>, organizationId: string, date: string): Promise<boolean> {
  const inserted = await admin.from("alert_digests").insert({ organization_id: organizationId, digest_date: date }).select("id");
  if (!inserted.error) {
    return true;
  }
  if (inserted.error.code !== "23505") {
    throw new Error("Impossible de réserver l'envoi des alertes.", { cause: inserted.error });
  }
  const retried = await admin
    .from("alert_digests")
    .update({ status: "pending", error: null })
    .eq("organization_id", organizationId)
    .eq("digest_date", date)
    .eq("status", "failed")
    .select("id");
  return (retried.data?.length ?? 0) > 0;
}

async function finishDigest(admin: SupabaseClient<Database>, organizationId: string, date: string, outcome: DigestOutcome, error: string | null = null) {
  await admin
    .from("alert_digests")
    .update({ status: outcome.status as DigestStatus, alert_count: outcome.alerts, recipient_count: outcome.recipients, error: error?.slice(0, 500) ?? null })
    .eq("organization_id", organizationId)
    .eq("digest_date", date);
}

async function digestFor(
  admin: SupabaseClient<Database>,
  organization: { id: string; name: string; settings: Database["public"]["Tables"]["organizations"]["Row"]["settings"] },
  { today, appName, siteUrl, send }: { today: string; appName: string; siteUrl: string; send: typeof sendEmails },
): Promise<DigestOutcome> {
  const settings = parseOrganizationSettings(organization.settings);
  const dashboard = await loadDashboard(
    admin,
    {
      organizationId: organization.id,
      uncashedAlertDays: settings.uncashed_alert_days,
      lowStockThreshold: settings.low_stock_threshold,
      invoiceAlertDays: settings.invoice_alert_days,
    },
    today,
  );
  const declaration = await loadDeclarationReminder(admin, organization.id, settings.declaration_reminder_days, today);
  const alerts = buildAlerts(dashboard, { lcnAlertDays: settings.lcn_alert_days, declaration });
  const base = { organizationId: organization.id, alerts: alerts.length };

  if (alerts.length === 0) {
    const outcome: DigestOutcome = { ...base, status: "no_alerts", recipients: 0 };
    await finishDigest(admin, organization.id, today, outcome);
    return outcome;
  }

  const { data: members, error } = await admin
    .from("memberships")
    .select("role, profiles ( email )")
    .eq("organization_id", organization.id)
    .eq("email_alerts", true)
    .in("role", [...RECIPIENT_ROLES]);
  if (error) {
    throw new Error("Impossible de lire les destinataires.", { cause: error });
  }
  const recipients = [...new Set(members.flatMap((m) => (m.profiles?.email ? [m.profiles.email] : [])))];
  if (recipients.length === 0) {
    const outcome: DigestOutcome = { ...base, status: "no_recipients", recipients: 0 };
    await finishDigest(admin, organization.id, today, outcome);
    return outcome;
  }

  const email = digestEmail({ appName, organizationName: organization.name, date: today, alerts, siteUrl });
  const messages: EmailMessage[] = recipients.map((to) => ({ to, ...email }));
  const result = await send(messages, { idempotencyKey: `alertes/${organization.id}/${today}` });
  const outcome: DigestOutcome = { ...base, status: result.status, recipients: recipients.length };
  await finishDigest(admin, organization.id, today, outcome, result.status === "failed" ? result.error : null);
  return outcome;
}
