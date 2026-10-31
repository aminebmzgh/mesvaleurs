import "server-only";
import { parseOrganizationSettings } from "@/lib/organizations/settings";
import type { createClient } from "@/lib/supabase/server";
import { aiConfig } from "./openrouter";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AiStatus = {
  /** Clé du service configurée sur le serveur. */
  configured: boolean;
  /** Activée par un administrateur de l'entreprise. */
  enabled: boolean;
  quota: number;
  /** Lectures du mois en cours (UTC, comme le quota en base). */
  used: number;
};

/** Début du mois en cours, en UTC : remise à zéro du quota (cf. reserve_ai_usage). */
export function monthStartUtc(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getAiStatus(supabase: Supabase, organizationId: string): Promise<AiStatus> {
  const [{ data: organization }, { count }] = await Promise.all([
    supabase.from("organizations").select("settings").eq("id", organizationId).single(),
    supabase
      .from("ai_usages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", monthStartUtc()),
  ]);
  const settings = parseOrganizationSettings(organization?.settings);
  return { configured: aiConfig() !== null, enabled: settings.ai_enabled, quota: settings.ai_monthly_quota, used: count ?? 0 };
}
