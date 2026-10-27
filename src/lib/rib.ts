/**
 * RIB marocain : 24 chiffres = code banque (3) + code ville (3) + numéro de compte (16) + clé (2).
 * La clé vaut 97 − ((22 premiers chiffres × 100) mod 97) ; de façon équivalente,
 * le RIB complet est divisible par 97.
 */

export type RibParts = {
  bankCode: string;
  cityCode: string;
  accountNumber: string;
  key: string;
};

/** Retire espaces, tirets et points de saisie. */
export function normalizeRib(value: string): string {
  return value.replace(/[\s.\-\u00A0]/g, "");
}

/** Calcule la clé (2 chiffres) à partir des 22 premiers chiffres. */
export function computeRibKey(first22Digits: string): string {
  if (!/^\d{22}$/.test(first22Digits)) {
    throw new RangeError("Le calcul de la clé attend 22 chiffres.");
  }
  return String(97n - ((BigInt(first22Digits) * 100n) % 97n)).padStart(2, "0");
}

export function isValidRib(value: string): boolean {
  const rib = normalizeRib(value);
  return /^\d{24}$/.test(rib) && computeRibKey(rib.slice(0, 22)) === rib.slice(22);
}

export function parseRib(value: string): RibParts | null {
  const rib = normalizeRib(value);
  if (!isValidRib(rib)) {
    return null;
  }
  return {
    bankCode: rib.slice(0, 3),
    cityCode: rib.slice(3, 6),
    accountNumber: rib.slice(6, 22),
    key: rib.slice(22),
  };
}

/** Affichage par blocs : « 150 500 2115014416910015 83 ». */
export function formatRib(value: string): string {
  const parts = parseRib(value);
  if (!parts) {
    return value;
  }
  return `${parts.bankCode} ${parts.cityCode} ${parts.accountNumber} ${parts.key}`;
}
