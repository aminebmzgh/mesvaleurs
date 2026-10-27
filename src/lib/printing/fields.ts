import { z } from "zod";

/**
 * Zones imprimables d'une formule. Coordonnées en millimètres depuis le coin
 * supérieur gauche de la formule ; `y` est la ligne de base du texte (la ligne
 * pointillée sur laquelle on écrit).
 */
export const PRINT_FIELDS = [
  "amount_digits",
  "amount_words_1",
  "amount_words_2",
  "amount_words_3",
  "payee",
  "place",
  "date",
  "place_and_date",
  "due_date",
  "drawer_name",
  "drawer_address",
  "drawee_name",
  "drawee_address",
  "account_rib",
  "bank_branch",
  "bank_city",
  "cause",
] as const;

export type PrintField = (typeof PRINT_FIELDS)[number];

export const PRINT_FIELD_LABELS: Record<PrintField, string> = {
  amount_digits: "Montant en chiffres",
  amount_words_1: "Montant en lettres (ligne 1)",
  amount_words_2: "Montant en lettres (ligne 2)",
  amount_words_3: "Montant en lettres (ligne 3)",
  payee: "Bénéficiaire (à l'ordre de)",
  place: "Lieu",
  date: "Date",
  place_and_date: "Lieu et date de création",
  due_date: "Date d'échéance",
  drawer_name: "Tireur : nom",
  drawer_address: "Tireur : adresse",
  drawee_name: "Tiré : nom",
  drawee_address: "Tiré : adresse",
  account_rib: "Compte (RIB) du tiré",
  bank_branch: "Agence",
  bank_city: "Ville de l'agence",
  cause: "La cause (factures réglées)",
};

export const zoneSchema = z.object({
  field: z.enum(PRINT_FIELDS),
  x: z.number().min(0).max(300),
  y: z.number().min(0).max(300),
  width: z.number().min(5).max(300),
  fontSize: z.number().min(5).max(24),
  align: z.enum(["left", "center", "right"]),
});

export type PrintZone = z.infer<typeof zoneSchema>;

export const templateOptionsSchema = z.object({
  /** Caractère encadrant le montant en chiffres contre la falsification (#1 234,56#). */
  amountFrame: z.enum(["#", "*", "none"]).catch("#").default("#"),
  /** Police : Helvetica (proportionnelle) ou Courier (chasse fixe). */
  font: z.enum(["helvetica", "courier"]).catch("helvetica").default("helvetica"),
  /** Texte en majuscules (bénéficiaire, montant en lettres…). */
  uppercase: z.boolean().catch(false).default(false),
});

export type TemplateOptions = z.infer<typeof templateOptionsSchema>;

export type PrintTemplate = {
  name: string;
  type: "check" | "lcn";
  widthMm: number;
  heightMm: number;
  offsetXMm: number;
  offsetYMm: number;
  zones: PrintZone[];
  options: TemplateOptions;
};

/** Lecture tolérante des zones enregistrées (JSON) : zones invalides ignorées. */
export function parseZones(value: unknown): PrintZone[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((zone) => {
    const parsed = zoneSchema.safeParse(zone);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseTemplateOptions(value: unknown): TemplateOptions {
  return templateOptionsSchema.parse(value && typeof value === "object" && !Array.isArray(value) ? value : {});
}

/** 1 mm en points PDF (1 pt = 1/72 pouce). */
export const MM_TO_PT = 72 / 25.4;
