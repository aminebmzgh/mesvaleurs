/**
 * Masquage des données personnelles d'un texte avant son envoi au modèle d'IA
 * (loi 09-08) : adresses e-mail, numéros de téléphone, RIB et IBAN. Les
 * identifiants d'entreprise utiles à la saisie (ICE, IF, RC) sont conservés.
 */
const RULES: { pattern: RegExp; replacement: string }[] = [
  { pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, replacement: "[e-mail]" },
  // IBAN marocain (MA + 26 chiffres), espaces compris
  { pattern: /\bMA\s?\d{2}(?:\s?\d){24}\b/gi, replacement: "[IBAN]" },
  // RIB : 24 chiffres, en un bloc ou par groupes (3 3 16 2, 3 3 4 4 4 4 2…)
  { pattern: /\b\d(?:[ .-]?\d){23}\b/g, replacement: "[RIB]" },
  // Téléphone marocain : +212 / 00212 / 0, suivi de 9 chiffres (5, 6, 7 ou 8 en tête)
  { pattern: /(?:\+212|00212|\b0)\s?\(?0?\)?\s?[5-8](?:[\s.-]?\d){8}\b/g, replacement: "[téléphone]" },
];

export function maskPersonalData(text: string): string {
  return RULES.reduce((current, { pattern, replacement }) => current.replace(pattern, replacement), text);
}
