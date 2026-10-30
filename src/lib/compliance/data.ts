import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { type DeclarationReminder, declarationReminder, declarationRequired, type LegalParams } from "./late-payments";

/** Valeurs de secours si un paramètre manque en base (ne devrait pas arriver). */
const FALLBACK: LegalParams = {
  firstMonthRate: 2.25,
  additionalMonthRate: 0.85,
  minInvoiceAmount: 0,
  declarationMonthsAfterQuarter: 1,
  revenueThreshold: 2_000_000,
};

const KEYS: Record<keyof LegalParams, string> = {
  firstMonthRate: "late_fine_first_month_rate",
  additionalMonthRate: "late_fine_additional_month_rate",
  minInvoiceAmount: "late_fine_min_invoice_amount",
  declarationMonthsAfterQuarter: "declaration_months_after_quarter",
  revenueThreshold: "declaration_revenue_threshold",
};

/** Paramètres légaux de la loi 69-21 (table `legal_settings`, commune à toutes les entreprises). */
export async function loadLegalParams(supabase: SupabaseClient<Database>): Promise<LegalParams> {
  const { data } = await supabase.from("legal_settings").select("key, value").in("key", Object.values(KEYS));
  const values = new Map((data ?? []).map((row) => [row.key, Number(row.value)]));
  return Object.fromEntries(
    (Object.keys(KEYS) as (keyof LegalParams)[]).map((name) => [name, values.get(KEYS[name]) ?? FALLBACK[name]]),
  ) as LegalParams;
}

/**
 * Rappel de la déclaration trimestrielle d'une entreprise, avec le client donné (session
 * ou service_role) ; null si elle n'est pas tenue de déclarer ou si c'est déjà fait.
 */
export async function loadDeclarationReminder(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  reminderDays: number,
  today: string,
): Promise<DeclarationReminder | null> {
  const [params, organization, declarations] = await Promise.all([
    loadLegalParams(supabase),
    supabase.from("organizations").select("annual_revenue").eq("id", organizationId).maybeSingle(),
    supabase.from("late_payment_declarations").select("year, quarter").eq("organization_id", organizationId),
  ]);
  if (!declarationRequired(organization.data?.annual_revenue ?? null, params)) {
    return null;
  }
  return declarationReminder(today, declarations.data ?? [], reminderDays, params);
}
