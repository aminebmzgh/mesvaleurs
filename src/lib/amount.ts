/**
 * Saisie et calcul des montants en dirhams.
 * Les calculs se font en centimes (entiers) pour éviter les erreurs de virgule flottante.
 */

/**
 * Analyse un montant saisi : « 1 234,56 », « 1234,56 », « 1.234,56 », « 1234.56 ».
 * - virgule présente : c'est le séparateur décimal, les points sont des milliers ;
 * - sinon un point unique est décimal ; plusieurs points sont des milliers.
 * Renvoie null si la saisie n'est pas un montant valide (au plus 2 décimales).
 */
export function parseAmount(input: string, { allowNegative = false } = {}): number | null {
  let text = input.trim().replace(/[\s  ]/g, "").replace(/(DH|MAD)$/i, "");
  if (text === "") {
    return null;
  }
  const negative = text.startsWith("-");
  if (negative) {
    if (!allowNegative) {
      return null;
    }
    text = text.slice(1);
  }

  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if ((text.match(/\./g) ?? []).length > 1) {
    text = text.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return negative ? -value : value;
}

/** Montant → centimes entiers (arrondi au centime). */
export function toCents(amount: number): number {
  return Math.round(Number(`${Math.abs(amount)}e2`)) * (amount < 0 ? -1 : 1);
}

/** Centimes → montant en dirhams. */
export function fromCents(cents: number): number {
  return cents / 100;
}
