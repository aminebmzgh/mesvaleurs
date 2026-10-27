import type { AppRole } from "@/types/app";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrateur",
  manager: "Gestionnaire",
  preparer: "Préparateur",
  accountant: "Comptable",
  external_accountant: "Expert-comptable externe",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Accès complet, gestion des membres et des paramètres",
  manager: "Gère comptes, chéquiers, paiements et rapprochements",
  preparer: "Prépare les paiements, saisit fournisseurs et factures",
  accountant: "Lecture et exports",
  external_accountant: "Lecture et exports, pour le cabinet comptable",
};

export const ROLES = Object.keys(ROLE_LABELS) as AppRole[];

/** Rôles pour lesquels la double authentification peut être rendue obligatoire. */
export const MFA_ELIGIBLE_ROLES: AppRole[] = ["admin", "manager"];

/** Rôles autorisés à modifier les données métier (les autres sont en lecture seule). */
export const WRITER_ROLES: AppRole[] = ["admin", "manager", "preparer"];

export function hasRole(role: AppRole, allowed: readonly AppRole[]) {
  return allowed.includes(role);
}

/** Rôles autorisés à gérer comptes bancaires, chéquiers et modèles d'impression. */
export const ACCOUNT_MANAGER_ROLES: AppRole[] = ["admin", "manager"];
