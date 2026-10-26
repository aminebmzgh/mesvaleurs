import type { PrintTemplate, PrintZone } from "./fields";

/**
 * Modèles par défaut des formules marocaines, relevés sur des formules réelles
 * (chèques 175 × 80 mm, LCN 200 × 105 mm). Précision d'environ ±2 mm : ce sont des
 * points de départ, à ajuster avec l'impression test sur papier blanc et le
 * décalage imprimante.
 */

const zone = (
  field: PrintZone["field"],
  x: number,
  y: number,
  width: number,
  fontSize = 10,
  align: PrintZone["align"] = "left",
): PrintZone => ({ field, x, y, width, fontSize, align });

const CHECK_SIZE = { widthMm: 175, heightMm: 80 };
const LCN_SIZE = { widthMm: 200, heightMm: 105 };
const NO_OFFSET = { offsetXMm: 0, offsetYMm: 0 };
const DEFAULT_OPTIONS = { amountFrame: "#", font: "helvetica", uppercase: false } as const;

export type DefaultTemplate = PrintTemplate & {
  /** Identifiant stable du modèle par défaut. */
  key: string;
  /** Sigle de la banque (`banks.short_name`), null pour un modèle générique. */
  bankShortName: string | null;
};

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    key: "check-awb",
    bankShortName: "AWB",
    name: "Chèque Attijariwafa bank",
    type: "check",
    ...CHECK_SIZE,
    ...NO_OFFSET,
    options: { ...DEFAULT_OPTIONS },
    zones: [
      zone("amount_digits", 117.6, 13.2, 39.5, 11),
      zone("amount_words_1", 38.2, 18.5, 95),
      zone("amount_words_2", 6.6, 25.2, 151),
      zone("payee", 23, 31.5, 132),
      zone("place", 70.5, 39.2, 40),
      zone("date", 118.5, 39.2, 40),
    ],
  },
  {
    key: "check-bp",
    bankShortName: "BP",
    name: "Chèque Banque Populaire",
    type: "check",
    ...CHECK_SIZE,
    ...NO_OFFSET,
    options: { ...DEFAULT_OPTIONS },
    zones: [
      zone("amount_digits", 130, 6.2, 30, 11),
      zone("amount_words_1", 39, 23.5, 92),
      zone("amount_words_2", 4, 29.4, 155),
      zone("payee", 21.4, 34.3, 133),
      zone("place", 66, 40.1, 40),
      zone("date", 115, 40.1, 40),
    ],
  },
  {
    key: "check-cam",
    bankShortName: "CAM",
    name: "Chèque Crédit Agricole du Maroc",
    type: "check",
    ...CHECK_SIZE,
    ...NO_OFFSET,
    options: { ...DEFAULT_OPTIONS },
    zones: [
      zone("amount_digits", 140.5, 10.3, 27, 11),
      zone("amount_words_1", 41.8, 21.2, 98),
      zone("amount_words_2", 6.6, 26.5, 150),
      zone("payee", 27, 31.8, 128),
      zone("place", 75.4, 37.3, 38),
      zone("date", 122.4, 37.3, 38),
    ],
  },
  {
    key: "check-cih",
    bankShortName: "CIH",
    name: "Chèque CIH Bank",
    type: "check",
    ...CHECK_SIZE,
    ...NO_OFFSET,
    options: { ...DEFAULT_OPTIONS },
    zones: [
      zone("amount_digits", 137.7, 6.2, 26, 11),
      zone("amount_words_1", 35, 17.1, 103),
      zone("amount_words_2", 4, 22.5, 155),
      zone("payee", 19, 29.4, 134),
      zone("place", 95.3, 36.4, 33),
      zone("date", 135.4, 40.1, 30),
    ],
  },
  {
    key: "lcn-awb",
    bankShortName: "AWB",
    name: "LCN Attijariwafa bank",
    type: "lcn",
    ...LCN_SIZE,
    ...NO_OFFSET,
    options: { ...DEFAULT_OPTIONS },
    zones: [
      zone("due_date", 150, 8.6, 46, 11),
      zone("amount_digits", 153, 18.4, 42, 11),
      zone("drawer_name", 2.6, 33.6, 66, 9),
      zone("drawer_address", 2.6, 42, 66, 8),
      zone("payee", 72, 29.1, 64, 9),
      zone("place_and_date", 72, 38.6, 64, 9),
      zone("cause", 72, 46.7, 64, 8),
      zone("amount_words_1", 141, 39.7, 54, 8),
      zone("amount_words_2", 141, 44.8, 54, 8),
      zone("amount_words_3", 141, 50.2, 54, 8),
      zone("drawee_name", 72, 58, 64, 9),
      zone("drawee_address", 72, 66.9, 64, 8),
      zone("account_rib", 72, 78.5, 64, 9),
      zone("bank_branch", 85, 82.6, 50, 8),
      zone("bank_city", 85, 87, 50, 8),
    ],
  },
  {
    key: "lcn-cam",
    bankShortName: "CAM",
    name: "LCN Crédit Agricole du Maroc",
    type: "lcn",
    ...LCN_SIZE,
    ...NO_OFFSET,
    options: { ...DEFAULT_OPTIONS },
    zones: [
      zone("due_date", 154.6, 6.9, 44, 11),
      zone("amount_digits", 157, 15.6, 40, 11),
      zone("drawer_name", 2.7, 32.2, 66, 9),
      zone("drawer_address", 2.7, 38.8, 66, 8),
      zone("payee", 76, 27.2, 68, 9),
      zone("place_and_date", 76, 36.9, 68, 9),
      zone("cause", 76, 45, 68, 8),
      zone("amount_words_1", 147.9, 37.5, 52, 8),
      zone("amount_words_2", 147.9, 43, 52, 8),
      zone("amount_words_3", 147.9, 48.6, 52, 8),
      zone("drawee_name", 76, 57.8, 68, 9),
      zone("drawee_address", 76, 66.7, 68, 8),
      zone("account_rib", 76, 75, 68, 9),
      zone("bank_branch", 87, 79.6, 50, 8),
      zone("bank_city", 87, 83.3, 50, 8),
    ],
  },
];

/** Modèles génériques, quand aucune banque ne correspond. */
export const GENERIC_TEMPLATES: Record<"check" | "lcn", DefaultTemplate> = {
  check: {
    ...DEFAULT_TEMPLATES.find((t) => t.key === "check-awb")!,
    key: "check-generic",
    bankShortName: null,
    name: "Chèque (modèle générique)",
  },
  lcn: {
    ...DEFAULT_TEMPLATES.find((t) => t.key === "lcn-awb")!,
    key: "lcn-generic",
    bankShortName: null,
    name: "LCN (modèle générique)",
  },
};

/** Modèle par défaut d'une banque et d'un type de formule, sinon le générique. */
export function defaultTemplateFor(type: "check" | "lcn", bankShortName: string | null | undefined): DefaultTemplate {
  return (
    DEFAULT_TEMPLATES.find((t) => t.type === type && t.bankShortName === bankShortName) ?? GENERIC_TEMPLATES[type]
  );
}

export function findDefaultTemplate(key: string): DefaultTemplate | undefined {
  return [...DEFAULT_TEMPLATES, ...Object.values(GENERIC_TEMPLATES)].find((t) => t.key === key);
}
