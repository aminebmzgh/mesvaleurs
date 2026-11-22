import "server-only";
import { hasFeature, type PlanId } from "@/lib/billing/plans";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { PORTAL_TOKEN_PATTERN, type PortalData, portalUrl } from "./portal";

/** Portail public d'un fournisseur, ou null si le lien est inconnu, désactivé ou hors offre. */
export async function getPortal(token: string): Promise<PortalData | null> {
  if (!PORTAL_TOKEN_PATTERN.test(token)) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_supplier_portal", { p_token: token });
  if (error) {
    throw new Error("Impossible d'afficher le suivi des règlements.", { cause: error });
  }
  return (data as PortalData | null) ?? null;
}

export type SupplierPortalLink = { url: string; createdAt: string; lastViewedAt: string | null; viewCount: number };

/** Lien actif du portail d'un fournisseur de l'entreprise active (lecture soumise à la RLS). */
export async function getSupplierPortalLink(supplierId: string): Promise<SupplierPortalLink | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier_portal_links")
    .select("token, created_at, last_viewed_at, view_count")
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  return {
    url: portalUrl(publicEnv.NEXT_PUBLIC_SITE_URL, data.token),
    createdAt: data.created_at,
    lastViewedAt: data.last_viewed_at,
    viewCount: data.view_count,
  };
}

/** Lien à ajouter aux documents envoyés au fournisseur (e-mail, lettre), si l'offre le comprend et qu'un lien est actif. */
export async function portalUrlForDocuments(plan: PlanId, supplierId: string): Promise<string | null> {
  if (!hasFeature(plan, "supplier_portal")) {
    return null;
  }
  return (await getSupplierPortalLink(supplierId))?.url ?? null;
}
