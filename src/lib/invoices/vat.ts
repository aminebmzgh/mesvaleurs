/**
 * Calcul de la TVA à la saisie d'une facture (pré-remplissage, modifiable).
 * Montants en centimes ; HT + TVA = TTC exactement, l'arrondi porte sur la TVA ou le HT.
 */

/** Taux normal de TVA au Maroc, proposé par défaut. */
export const DEFAULT_VAT_RATE = 20;

/** Depuis le HT : TVA arrondie au centime, TTC = HT + TVA. */
export function fromExclTax(exclCents: number, rate = DEFAULT_VAT_RATE): { vatCents: number; inclCents: number } {
  const vatCents = Math.round((exclCents * rate) / 100);
  return { vatCents, inclCents: exclCents + vatCents };
}

/** Depuis le TTC : HT arrondi au centime, TVA = TTC − HT. */
export function fromInclTax(inclCents: number, rate = DEFAULT_VAT_RATE): { exclCents: number; vatCents: number } {
  const exclCents = Math.round((inclCents * 100) / (100 + rate));
  return { exclCents, vatCents: inclCents - exclCents };
}
