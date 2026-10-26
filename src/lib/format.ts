/**
 * Formats d'affichage marocains : montants en dirhams et dates jj/mm/aaaa.
 * Formatage déterministe (indépendant des données ICU du navigateur), car les
 * mêmes chaînes sont imprimées sur les chèques et LCN.
 */

/** Espace insécable : sépare les milliers sans permettre de retour à la ligne. */
const THOUSANDS_SEPARATOR = "\u00A0";

/**
 * Convertit un montant positif en centimes, arrondi au centime le plus proche.
 * Le décalage décimal passe par la notation exponentielle pour éviter les
 * erreurs de virgule flottante (1.005 * 100 = 100.49999…).
 */
function toRoundedCents(absValue: number): number {
  const text = String(absValue);
  if (text.includes("e")) {
    return Math.round(absValue * 100);
  }
  return Math.round(Number(`${text}e2`));
}

/**
 * Formate un nombre avec deux décimales : 1234.5 → « 1 234,50 ».
 * L'arrondi se fait au centime le plus proche.
 */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Montant invalide : ${value}`);
  }
  const cents = toRoundedCents(Math.abs(value));
  const integerPart = Math.floor(cents / 100).toString();
  const decimalPart = (cents % 100).toString().padStart(2, "0");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
  const sign = value < 0 && cents > 0 ? "-" : "";
  return `${sign}${grouped},${decimalPart}`;
}

/** Montant en dirhams : 1234.56 → « 1 234,56 DH ». */
export function formatMAD(value: number): string {
  return `${formatAmount(value)}${THOUSANDS_SEPARATOR}DH`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Date au format jj/mm/aaaa.
 * - Une date seule (« 2026-10-26 », colonne SQL `date`) est formatée telle quelle,
 *   sans conversion de fuseau.
 * - Un instant (Date, ou horodatage ISO) est converti dans le fuseau Africa/Casablanca.
 */
export function formatDate(value: string | Date, timeZone = "Africa/Casablanca"): string {
  if (typeof value === "string") {
    const match = ISO_DATE.exec(value);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Date invalide : ${String(value)}`);
  }
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}
