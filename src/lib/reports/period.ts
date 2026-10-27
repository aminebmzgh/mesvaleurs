/** Mois de rapport au format AAAA-MM, et calculs associés. */

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH.test(value);
}

/** Premier et dernier jour du mois (AAAA-MM-JJ). */
export function monthRange(month: string): { start: string; end: string } {
  const match = MONTH.exec(month);
  if (!match) {
    throw new RangeError(`Mois invalide : ${month}`);
  }
  const year = Number(match[1]);
  const index = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const { start } = monthRange(month);
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

/** « octobre 2026 ». */
export function monthLabel(month: string): string {
  const { start } = monthRange(month);
  return `${MONTH_NAMES[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`;
}

/** Numéros attribuables d'un carnet (du premier au dernier utilisé) absents des paiements. */
export function missingNumbers(firstNumber: number, nextNumber: number, used: Iterable<number>, limit = 200): number[] {
  const usedSet = new Set(used);
  const missing: number[] = [];
  for (let number = firstNumber; number < nextNumber && missing.length < limit; number += 1) {
    if (!usedSet.has(number)) {
      missing.push(number);
    }
  }
  return missing;
}

/** Tranche d'ancienneté d'un paiement en circulation. */
export function ageBucket(days: number): "< 30 j" | "30 à 60 j" | "60 à 90 j" | "> 90 j" {
  if (days < 30) {
    return "< 30 j";
  }
  if (days < 60) {
    return "30 à 60 j";
  }
  return days < 90 ? "60 à 90 j" : "> 90 j";
}
