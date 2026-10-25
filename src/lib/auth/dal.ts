import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";
import { MFA_ELIGIBLE_ROLES } from "./roles";

/**
 * Couche d'accès aux données (DAL) : point unique de vérification de la session,
 * de la double authentification et de l'organisation active.
 * Chaque page, Server Action et Route Handler protégés passe par ces fonctions.
 * La RLS reste la garantie finale côté base.
 */

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
};

export type OrganizationMembership = {
  organizationId: string;
  organizationName: string;
  role: AppRole;
};

export type ActiveOrganization = OrganizationMembership & {
  memberships: OrganizationMembership[];
  mfaRequired: boolean;
};

/** Utilisateur connecté, ou null. Mis en cache pour la durée de la requête. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile?.full_name ?? null,
  };
});

/** Niveau d'authentification de la session courante (aal1 ou aal2). */
const getAssuranceLevel = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data;
});

/**
 * Exige un utilisateur connecté et, s'il a activé la double authentification,
 * une session vérifiée par son second facteur (niveau aal2).
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/connexion");
  }

  const aal = await getAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/verification-mfa");
  }

  return user;
});

/** Organisations dont l'utilisateur est membre, triées par nom. */
export const getMemberships = cache(async (): Promise<OrganizationMembership[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organization_id, organizations ( name )")
    .eq("user_id", user.id);

  if (error) {
    throw new Error("Impossible de charger vos organisations.", { cause: error });
  }

  return (data ?? [])
    .map((row) => ({
      organizationId: row.organization_id,
      organizationName: row.organizations?.name ?? "",
      role: row.role,
    }))
    .sort((a, b) => a.organizationName.localeCompare(b.organizationName, "fr"));
});

const loadActiveOrganization = cache(async (): Promise<ActiveOrganization> => {
  const user = await requireUser();
  const memberships = await getMemberships();
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;

  let active = memberships.find((m) => m.organizationId === fromCookie);
  if (!active) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("last_organization_id")
      .eq("id", user.id)
      .maybeSingle();
    active =
      memberships.find((m) => m.organizationId === profile?.last_organization_id) ??
      memberships[0];
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", active.organizationId)
    .single();
  const settings = (organization?.settings ?? {}) as { require_mfa?: boolean };

  return {
    ...active,
    memberships,
    mfaRequired: Boolean(settings.require_mfa) && MFA_ELIGIBLE_ROLES.includes(active.role),
  };
});

type OrganizationOptions = {
  /** Autorise l'accès sans la double authentification exigée (page Sécurité). */
  allowMissingMfa?: boolean;
};

/**
 * Organisation active : celle du cookie si l'utilisateur en est membre, sinon la
 * dernière utilisée, sinon la première. Sans organisation, redirige vers l'onboarding.
 * Si l'organisation impose la double authentification pour le rôle de
 * l'utilisateur et qu'elle n'est pas active, redirige vers la page Sécurité.
 */
export async function requireActiveOrganization(
  options: OrganizationOptions = {},
): Promise<ActiveOrganization> {
  const organization = await loadActiveOrganization();
  if (organization.mfaRequired && !options.allowMissingMfa) {
    const aal = await getAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      redirect("/parametres/securite?mfa=requise");
    }
  }
  return organization;
}

/** Exige l'un des rôles donnés dans l'organisation active. */
export async function requireRole(
  allowed: readonly AppRole[],
  options: OrganizationOptions = {},
): Promise<ActiveOrganization> {
  const organization = await requireActiveOrganization(options);
  if (!allowed.includes(organization.role)) {
    redirect("/tableau-de-bord?erreur=acces-refuse");
  }
  return organization;
}
