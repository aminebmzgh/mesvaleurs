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

/** Alerte « LCN à échoir » par défaut : échéance dans les N jours (spec §8). */
export const LCN_ALERT_DEFAULT = 7;
/** Alerte « facture proche de la date limite légale » par défaut (loi 69-21). */
export const INVOICE_ALERT_DEFAULT = 7;
/** Délais d'alerte proposés dans les paramètres (jours). */
export const DUE_ALERT_CHOICES = [3, 7, 15, 30] as const;

/** Rappel de la déclaration trimestrielle des délais de paiement (loi 69-21), jours avant la date limite. */
export const DECLARATION_REMINDER_DEFAULT = 15;
export const DECLARATION_REMINDER_CHOICES = [7, 15, 30] as const;

const accountCode = (fallback: string) => z.string().regex(/^[A-Za-z0-9._-]{1,20}$/).catch(fallback).default(fallback);

/**
 * Export comptable mensuel (journal des règlements fournisseurs, spec §11.2) : comptes du
 * plan comptable marocain par défaut, format du fichier, base d'enregistrement.
 */
export const accountingExportSchema = z.object({
  journal: accountCode("BQ"),
  /** Fournisseurs (4411) ; le code du fournisseur, s'il existe, va en compte auxiliaire. */
  supplierAccount: accountCode("44110000"),
  /** Banque (5141), sauf code propre au compte bancaire. */
  bankAccount: accountCode("51410000"),
  /** Effets à payer (4415) : LCN enregistrées à l'émission. */
  billsAccount: accountCode("44150000"),
  /** « debit » : règlements à leur date de débit ; « issue » : à leur émission (LCN par les effets à payer). */
  basis: z.enum(["debit", "issue"]).catch("debit").default("debit"),
  separator: z.enum([";", ",", "tab"]).catch(";").default(";"),
  dateFormat: z.enum(["dd/mm/yyyy", "yyyy-mm-dd", "ddmmyy"]).catch("dd/mm/yyyy").default("dd/mm/yyyy"),
  decimal: z.enum([",", "."]).catch(",").default(","),
  header: z.boolean().catch(true).default(true),
});

export type AccountingExportSettings = z.infer<typeof accountingExportSchema>;

export const organizationSettingsSchema = z.object({
  /** Double authentification obligatoire pour administrateurs et gestionnaires. */
  require_mfa: z.boolean().catch(false).default(false),
  /** Montant en lettres selon l'orthographe rectifiée de 1990. */
  amount_words_rectified: z.boolean().catch(false).default(false),
  /** Délai au-delà duquel un chèque émis non encaissé est signalé (jours). */
  uncashed_alert_days: z.number().int().min(15).max(365).catch(UNCASHED_ALERT_DEFAULT).default(UNCASHED_ALERT_DEFAULT),
  /** Formules restantes à partir desquelles un carnet est signalé « presque épuisé ». */
  low_stock_threshold: z.number().int().min(1).max(100).catch(LOW_STOCK_DEFAULT).default(LOW_STOCK_DEFAULT),
  /** Alerte des LCN dont l'échéance tombe dans ce délai (jours). */
  lcn_alert_days: z.number().int().min(1).max(60).catch(LCN_ALERT_DEFAULT).default(LCN_ALERT_DEFAULT),
  /** Alerte des factures dont la date limite légale tombe dans ce délai (jours). */
  invoice_alert_days: z.number().int().min(1).max(60).catch(INVOICE_ALERT_DEFAULT).default(INVOICE_ALERT_DEFAULT),
  /** Loi 69-21 : date de paiement retenue (remise du chèque / échéance de la LCN, ou débit). */
  late_payment_basis: z.enum(["remittance", "debit"]).catch("remittance").default("remittance"),
  /** Loi 69-21 : rappel de la déclaration trimestrielle, jours avant la date limite. */
  declaration_reminder_days: z
    .number()
    .int()
    .min(1)
    .max(60)
    .catch(DECLARATION_REMINDER_DEFAULT)
    .default(DECLARATION_REMINDER_DEFAULT),
  /** Double signature : validation exigée pour toute formule au-delà de ce montant (DH) ; null = désactivée. */
  approval_threshold: z.number().positive().nullable().catch(null).default(null),
  /** Plafond journalier de l'entreprise (total des paiements datés du jour, DH) ; null = aucun. */
  daily_ceiling: z.number().positive().nullable().catch(null).default(null),
  /** Optimiseur de paiements : solde prévisionnel à ne jamais entamer (DH). */
  payment_reserve: z.number().min(0).catch(0).default(0),
  /** Absent : valeurs par défaut ; illisible : valeurs par défaut (les champs invalides le sont un à un). */
  accounting_export: accountingExportSchema.catch(() => accountingExportSchema.parse({})).prefault({}),
});

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export function parseOrganizationSettings(value: Json | null | undefined): OrganizationSettings {
  const object = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return organizationSettingsSchema.parse(object);
}
