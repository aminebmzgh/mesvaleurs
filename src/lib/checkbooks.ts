import type { Database } from "@/types/database";

export type InstrumentType = Database["public"]["Enums"]["instrument_type"];
export type CheckbookStatus = Database["public"]["Enums"]["checkbook_status"];

export const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  check: "Chéquier",
  lcn: "Carnet de LCN",
};

export const CHECKBOOK_STATUS_LABELS: Record<CheckbookStatus, string> = {
  active: "En service",
  exhausted: "Épuisé",
  archived: "Archivé",
};

/** Seuil d'alerte « chéquier presque épuisé » par défaut (spec §11 bis H). */
export const LOW_STOCK_THRESHOLD = 5;

/** Numéro de formule avec ses zéros initiaux : 1234 sur 7 chiffres → « 0001234 ». */
export function formatInstrumentNumber(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** Formules restantes d'un carnet (le prochain numéro compris). */
export function remainingCount(nextNumber: number, lastNumber: number): number {
  return Math.max(lastNumber - nextNumber + 1, 0);
}

/** Plage de formules vierges en opposition, bornes comprises. */
export type StoppedRange = [first: number, last: number];

const isStopped = (n: number, ranges: StoppedRange[]) => ranges.some(([first, last]) => n >= first && n <= last);

/** Numéros attribuables à la suite (`count` au plus), sans les formules vierges en opposition. */
export function availableNumbers(nextNumber: number, lastNumber: number, stopped: StoppedRange[], count: number): number[] {
  const numbers: number[] = [];
  for (let n = nextNumber; n <= lastNumber && numbers.length < count; n += 1) {
    if (!isStopped(n, stopped)) {
      numbers.push(n);
    }
  }
  return numbers;
}

/** Formules restantes d'un carnet, hors formules vierges en opposition. */
export function availableCount(nextNumber: number, lastNumber: number, stopped: StoppedRange[]): number {
  const opposed = stopped.reduce(
    (sum, [first, last]) => sum + Math.max(Math.min(last, lastNumber) - Math.max(first, nextNumber) + 1, 0),
    0,
  );
  return Math.max(remainingCount(nextNumber, lastNumber) - opposed, 0);
}
