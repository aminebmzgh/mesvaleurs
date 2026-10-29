import { z } from "zod";
import type { Json } from "@/types/database";

/**
 * Paramètres d'une organisation, stockés en JSON dans `organizations.settings`.
 * Toute lecture passe par ce schéma : valeurs absentes ou invalides → valeurs par défaut.
 */
/** Délai d'alerte par défaut pour un chèque non encaissé (spec §11 bis F). */
export const UNCASHED_ALERT_DEFAULT = 60;
/** Délais proposés dans les paramètres. */
export const UNCASHED_ALERT_CHOICES = [30, 60, 90, 120] as const;

/** Seuil d'alerte « chéquier presque épuisé » par défaut, en formules restantes (spec §11 bis H). */
export const LOW_STOCK_DEFAULT = 5;
/** Seuils proposés dans les paramètres. */
export const LOW_STOCK_CHOICES = [3, 5, 10, 15, 20] as const;

export const organizationSettingsSchema = z.object({
  /** Double authentification obligatoire pour administrateurs et gestionnaires. */
  require_mfa: z.boolean().catch(false).default(false),
  /** Montant en lettres selon l'orthographe rectifiée de 1990. */
  amount_words_rectified: z.boolean().catch(false).default(false),
  /** Délai au-delà duquel un chèque émis non encaissé est signalé (jours). */
  uncashed_alert_days: z.number().int().min(15).max(365).catch(UNCASHED_ALERT_DEFAULT).default(UNCASHED_ALERT_DEFAULT),
  /** Formules restantes à partir desquelles un carnet est signalé « presque épuisé ». */
  low_stock_threshold: z.number().int().min(1).max(100).catch(LOW_STOCK_DEFAULT).default(LOW_STOCK_DEFAULT),
});

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export function parseOrganizationSettings(value: Json | null | undefined): OrganizationSettings {
  const object = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return organizationSettingsSchema.parse(object);
}
