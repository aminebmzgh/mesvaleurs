import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Fournisseur d'une facture reçue (UBL, lecture par IA) : par son ICE, sinon par sa raison sociale exacte. */
export async function findSupplier(supabase: Supabase, organizationId: string, party: { ice: string | null; name: string | null }) {
  if (!party.ice && !party.name) {
    return null;
  }
  const query = supabase.from("suppliers").select("id, name").eq("organization_id", organizationId).limit(1);
  const { data } = party.ice ? await query.eq("ice", party.ice) : await query.ilike("name", party.name!.replace(/[%_\\]/g, ""));
  return data?.[0] ?? null;
}

/** Facture déjà enregistrée pour ce fournisseur avec ce numéro. */
export async function findDuplicate(supabase: Supabase, organizationId: string, supplierId: string, number: string) {
  const { data } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("supplier_id", supplierId)
    .eq("number", number)
    .limit(1);
  return data?.[0] ?? null;
}

export async function organizationIce(supabase: Supabase, organizationId: string) {
  const { data } = await supabase.from("organizations").select("ice").eq("id", organizationId).maybeSingle();
  return data?.ice ?? null;
}
