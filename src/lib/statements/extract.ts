/**
 * Extraction du numéro de chèque ou de LCN d'un libellé de relevé bancaire :
 * « CHQ 0001000 SOTRAMA », « PAIEMENT CHEQUE N°1001 », « ECH LCN 5000102 »…
 * Les zéros initiaux sont retirés : le numéro est comparé en valeur numérique.
 */

export type ExtractedNumber = { number: number; kind: "check" | "lcn" };

/** Mots qui peuvent séparer le mot-clé du numéro (« CHQ COMPENSE N° 1234567 »). */
const FILLER = String.raw`(?:(?:COMPENSE|COMPENSATION|EMIS|PAYE|PAIEMENT|REGLEMENT|SUR|DU)\s+)*`;
const NUMBER_MARK = String.raw`(?:N\s*[°O]?\s*\.?|NO\.?|NUM(?:ERO)?\.?)?\s*:?\s*`;
/** Numéro de 4 à 10 chiffres, non suivi d'un « / » (date) ni d'une virgule décimale. */
const DIGITS = String.raw`(\d{4,10})(?![\d/,.]\d)`;

const PATTERNS: { kind: ExtractedNumber["kind"]; regex: RegExp }[] = [
  {
    // LCN en premier : « ECH LCN » ou « EFFET » ne doivent pas être pris pour un chèque
    kind: "lcn",
    regex: new RegExp(String.raw`\b(?:L\.?C\.?N|EFFETS?|EFF|ECHEANCE|ECH)\s+` + FILLER + NUMBER_MARK + DIGITS),
  },
  {
    kind: "check",
    regex: new RegExp(String.raw`\b(?:CHEQUES?|CHEQ|CHQ|CH)\.?\s*` + FILLER + NUMBER_MARK + DIGITS),
  },
];

/** Libellé en majuscules, sans accents, espaces normalisés. */
export function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function extractInstrumentNumber(label: string): ExtractedNumber | null {
  const text = normalizeLabel(label);
  for (const { kind, regex } of PATTERNS) {
    const match = regex.exec(text);
    if (match) {
      const number = Number(match[1]);
      if (number > 0) {
        return { number, kind };
      }
    }
  }
  return null;
}
