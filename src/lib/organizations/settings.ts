import { z } from "zod";
import type { Json } from "@/types/database";

/**
 * Paramètres d'une organisation, stockés en JSON dans `organizations.settings`.
 * Toute lecture passe par ce schéma : valeurs absentes ou invalides → valeurs par défaut.
 */
export const organizationSettingsSchema = z.object({
  /** Double authentification obligatoire pour administrateurs et gestionnaires. */
  require_mfa: z.boolean().catch(false).default(false),
  /** Montant en lettres selon l'orthographe rectifiée de 1990. */
  amount_words_rectified: z.boolean().catch(false).default(false),
});

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export function parseOrganizationSettings(value: Json | null | undefined): OrganizationSettings {
  const object = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return organizationSettingsSchema.parse(object);
}
