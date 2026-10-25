/**
 * Préparation de l'internationalisation : l'interface est en français ; l'arabe
 * (écriture de droite à gauche) sera ajouté plus tard. Les composants utilisent
 * des propriétés CSS logiques (ms-/me-/ps-/pe-) pour fonctionner dans les deux sens.
 */
export const locales = ["fr", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  fr: "ltr",
  ar: "rtl",
};
