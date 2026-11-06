import "server-only";
import { aiQuotaFor, effectivePlan, hasFeature } from "@/lib/billing/plans";
import { parseOrganizationSettings } from "@/lib/organizations/settings";
import type { createClient } from "@/lib/supabase/server";
import { aiConfig } from "./openrouter";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AiStatus = {
  /** Clé du service configurée sur le serveur. */
  configured: boolean;
  /** IA comprise dans l'offre de l'entreprise. */
  included: boolean;
  /** Comprise dans l'offre et activée par un administrateur de l'entreprise. */
  enabled: boolean;
  /** Quota choisi par l'entreprise, dans la limite de son offre. */
  quota: number;
  /** Lectures du mois en cours (UTC, comme le quota en base). */
  used: number;
};

/** Début du mois en cours, en UTC : remise à zéro du quota (cf. reserve_ai_usage). */
export function monthStartUtc(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getAiStatus(supabase: Supabase, organizationId: string): Promise<AiStatus> {
  const [{ data: organization }, { data: subscription }, { count }] = await Promise.all([
    supabase.from("organizations").select("settings").eq("id", organizationId).single(),
    supabase.from("subscriptions").select("plan, trial_ends_at").eq("organization_id", organizationId).maybeSingle(),
    supabase
      .from("ai_usages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", monthStartUtc()),
  ]);
  const settings = parseOrganizationSettings(organization?.settings);
  const plan = effectivePlan(subscription);
  const included = hasFeature(plan, "ai");
  return {
    configured: aiConfig() !== null,
    included,
    enabled: included && settings.ai_enabled,
    quota: aiQuotaFor(plan, settings.ai_monthly_quota),
    used: count ?? 0,
  };
}
