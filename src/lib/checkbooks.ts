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
