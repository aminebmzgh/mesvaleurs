import "server-only";
import { monthStartUtc } from "@/lib/ai/usage";
import { createClient } from "@/lib/supabase/server";

export type PlanUsage = {
  bankAccounts: number;
  /** Membres et invitations en attente (comme la limite en base). */
  members: number;
  /** Paiements créés ce mois-ci (UTC), quel que soit leur statut. */
  monthlyPayments: number;
};

/** Consommation de l'entreprise au regard des limites de son offre. */
export async function getPlanUsage(organizationId: string): Promise<PlanUsage> {
  const supabase = await createClient();
  const count = { count: "exact", head: true } as const;
  const [accounts, members, invitations, payments] = await Promise.all([
    supabase.from("bank_accounts").select("id", count).eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("memberships").select("id", count).eq("organization_id", organizationId),
    supabase
      .from("invitations")
      .select("id", count)
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabase.from("payments").select("id", count).eq("organization_id", organizationId).gte("created_at", monthStartUtc()),
  ]);
  return {
    bankAccounts: accounts.count ?? 0,
    members: (members.count ?? 0) + (invitations.count ?? 0),
    monthlyPayments: payments.count ?? 0,
  };
}
