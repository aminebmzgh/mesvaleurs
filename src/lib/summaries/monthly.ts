import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiConfig, chat } from "@/lib/ai/openrouter";
import { loadLegalParams } from "@/lib/compliance/data";
import { type EmailMessage, emailConfig, sendEmails } from "@/lib/email/send";
import { parseOrganizationSettings } from "@/lib/organizations/settings";
import type { Database } from "@/types/database";
import { COMMENTARY_INSTRUCTIONS, commentaryFacts, summaryEmail } from "./email";
import { computeMonthlySummary, type MonthlySummary, previousMonth } from "./figures";

type Admin = SupabaseClient<Database>;
type Status = Database["public"]["Enums"]["alert_digest_status"];

export type SummaryOutcome = { organizationId: string; status: Status | "skipped"; recipients: number; commentary: boolean };

/** Destinataires : comme le récapitulatif des alertes (l'expert-comptable externe n'en reçoit pas). */
const RECIPIENT_ROLES = ["admin", "manager", "preparer", "accountant"] as const;

/** Paragraphe de l'assistant : null si l'IA n'est pas activée, le quota atteint ou le service indisponible. */
export type CommentaryWriter = (admin: Admin, organizationId: string, summary: MonthlySummary) => Promise<string | null>;

export const aiCommentary: CommentaryWriter = async (admin, organizationId, summary) => {
  const config = aiConfig();
  const { data: organization } = await admin.from("organizations").select("settings").eq("id", organizationId).single();
  const settings = parseOrganizationSettings(organization?.settings);
  if (!config || !settings.ai_enabled) {
    return null;
  }
  const { data: usageId } = await admin.rpc("reserve_ai_usage", {
    p_organization_id: organizationId,
    // Tâche planifiée : aucun utilisateur à l'origine de l'appel
    p_user_id: null as unknown as string,
    p_feature: "monthly_summary",
    p_monthly_quota: settings.ai_monthly_quota,
  });
  if (!usageId) {
    return null;
  }
  try {
    const result = await chat(
      {
        messages: [
          { role: "system", content: COMMENTARY_INSTRUCTIONS },
          { role: "user", content: `Chiffres de l'entreprise :\n${commentaryFacts(summary)}` },
        ],
        maxTokens: 500,
        reasoning: false,
      },
      { config },
    );
    await admin
      .from("ai_usages")
      .update({ model: result.model, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, cost: result.usage.cost, succeeded: true })
      .eq("id", usageId);
    return result.content?.trim().slice(0, 1500) || null;
  } catch {
    // Résumé envoyé sans le paragraphe
    await admin.from("ai_usages").update({ succeeded: false }).eq("id", usageId);
    return null;
  }
};

/** Chiffres du mois écoulé pour une entreprise (client service_role). */
export async function loadMonthlySummary(admin: Admin, organizationId: string, today: string): Promise<MonthlySummary> {
  const month = previousMonth(today);
  const [params, payments, invoices, accounts] = await Promise.all([
    loadLegalParams(admin),
    admin
      .from("payments")
      .select("type, status, amount, issue_date, due_date, debited_at, regularized_at")
      .eq("organization_id", organizationId)
      .neq("status", "draft")
      .or(`status.in.(issued,delivered,rejected),debited_at.gte.${month.start},issue_date.gte.${month.start}`)
      .limit(10000),
    admin
      .from("invoices")
      .select("number, legal_due_date, amount_incl_tax, amount_paid, status, suppliers ( name )")
      .eq("organization_id", organizationId)
      .in("status", ["unpaid", "partially_paid"])
      .limit(10000),
    admin.from("bank_accounts").select("current_balance").eq("organization_id", organizationId).eq("is_active", true),
  ]);
  const error = payments.error ?? invoices.error ?? accounts.error;
  if (error) {
    throw new Error("Impossible de lire les données du résumé.", { cause: error });
  }
  return computeMonthlySummary({
    month,
    today,
    params,
    balance: (accounts.data ?? []).reduce((sum, account) => (Math.round(sum * 100) + Math.round(Number(account.current_balance) * 100)) / 100, 0),
    payments: (payments.data ?? []).map((p) => ({
      type: p.type,
      status: p.status,
      amount: Number(p.amount),
      issueDate: p.issue_date,
      dueDate: p.due_date,
      debitedAt: p.debited_at,
      regularizedAt: p.regularized_at,
    })),
    invoices: (invoices.data ?? []).map((i) => ({
      number: i.number,
      supplier: i.suppliers?.name ?? "",
      legalDueDate: i.legal_due_date,
      amountInclTax: Number(i.amount_incl_tax),
      amountPaid: Number(i.amount_paid),
      status: i.status,
    })),
  });
}

/**
 * Résumé mensuel de chaque entreprise (tâche planifiée du 1er du mois, client service_role).
 * Une entreprise déjà traitée pour ce mois est ignorée ; un envoi échoué est retenté.
 */
export async function runMonthlySummaries({
  admin,
  today,
  appName,
  siteUrl,
  send = sendEmails,
  comment = aiCommentary,
  emailEnabled = emailConfig() !== null,
}: {
  admin: Admin;
  today: string;
  appName: string;
  siteUrl: string;
  send?: typeof sendEmails;
  comment?: CommentaryWriter;
  /** Envoi d'e-mails configuré : sinon, pas d'appel à l'IA pour un résumé qui ne partira pas. */
  emailEnabled?: boolean;
}): Promise<SummaryOutcome[]> {
  const month = previousMonth(today).start;
  const { data: organizations, error } = await admin.from("organizations").select("id, name").order("created_at");
  if (error) {
    throw new Error("Impossible de lire les entreprises.", { cause: error });
  }
  const outcomes: SummaryOutcome[] = [];
  for (const organization of organizations) {
    let outcome: SummaryOutcome;
    try {
      outcome = (await claim(admin, organization.id, month))
        ? await summaryFor(admin, organization, { today, month, appName, siteUrl, send, comment: emailEnabled ? comment : async () => null })
        : { organizationId: organization.id, status: "skipped", recipients: 0, commentary: false };
    } catch (cause) {
      outcome = { organizationId: organization.id, status: "failed", recipients: 0, commentary: false };
      await finish(admin, organization.id, month, outcome, cause instanceof Error ? cause.message : String(cause));
    }
    outcomes.push(outcome);
  }
  return outcomes;
}

async function claim(admin: Admin, organizationId: string, month: string): Promise<boolean> {
  const inserted = await admin.from("monthly_summaries").insert({ organization_id: organizationId, month }).select("id");
  if (!inserted.error) {
    return true;
  }
  if (inserted.error.code !== "23505") {
    throw new Error("Impossible de réserver l'envoi du résumé.", { cause: inserted.error });
  }
  const retried = await admin
    .from("monthly_summaries")
    .update({ status: "pending", error: null })
    .eq("organization_id", organizationId)
    .eq("month", month)
    .eq("status", "failed")
    .select("id");
  return (retried.data?.length ?? 0) > 0;
}

async function finish(admin: Admin, organizationId: string, month: string, outcome: SummaryOutcome, error: string | null = null) {
  await admin
    .from("monthly_summaries")
    .update({ status: outcome.status as Status, recipient_count: outcome.recipients, with_commentary: outcome.commentary, error: error?.slice(0, 500) ?? null })
    .eq("organization_id", organizationId)
    .eq("month", month);
}

async function summaryFor(
  admin: Admin,
  organization: { id: string; name: string },
  { today, month, appName, siteUrl, send, comment }: { today: string; month: string; appName: string; siteUrl: string; send: typeof sendEmails; comment: CommentaryWriter },
): Promise<SummaryOutcome> {
  const { data: members, error } = await admin
    .from("memberships")
    .select("profiles ( email )")
    .eq("organization_id", organization.id)
    .eq("email_monthly_summary", true)
    .in("role", [...RECIPIENT_ROLES]);
  if (error) {
    throw new Error("Impossible de lire les destinataires.", { cause: error });
  }
  const recipients = [...new Set(members.flatMap((m) => (m.profiles?.email ? [m.profiles.email] : [])))];
  if (recipients.length === 0) {
    const outcome: SummaryOutcome = { organizationId: organization.id, status: "no_recipients", recipients: 0, commentary: false };
    await finish(admin, organization.id, month, outcome);
    return outcome;
  }

  const summary = await loadMonthlySummary(admin, organization.id, today);
  const commentary = await comment(admin, organization.id, summary);
  const email = summaryEmail({ appName, organizationName: organization.name, summary, commentary, siteUrl });
  const messages: EmailMessage[] = recipients.map((to) => ({ to, ...email }));
  const result = await send(messages, { idempotencyKey: `resume-mensuel/${organization.id}/${month}` });
  const outcome: SummaryOutcome = { organizationId: organization.id, status: result.status, recipients: recipients.length, commentary: commentary !== null };
  await finish(admin, organization.id, month, outcome, result.status === "failed" ? result.error : null);
  return outcome;
}
