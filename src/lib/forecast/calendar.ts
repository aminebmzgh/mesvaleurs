/** Calendrier des échéances (spec §8) : grilles mois et semaine, état de chaque échéance. */

import { addDays } from "@/lib/dates";

export type DueStatus = "paid" | "pending" | "late";

export const DUE_STATUS_LABELS: Record<DueStatus, string> = {
  paid: "Payé",
  pending: "En attente",
  late: "En retard",
};

export type CalendarEventKind = "lcn" | "invoice" | "guarantee";

export const EVENT_KIND_LABELS: Record<CalendarEventKind, string> = {
  lcn: "Échéance de LCN",
  invoice: "Date limite de paiement",
  guarantee: "Restitution d'un chèque de garantie",
};

export type CalendarEvent = {
  date: string;
  kind: CalendarEventKind;
  status: DueStatus;
  label: string;
  supplier: string;
  amount: number;
  href: string;
};

/** Payé si réglé ; sinon en retard si l'échéance est passée, en attente sinon. */
export function dueStatus(settled: boolean, due: string, today: string): DueStatus {
  if (settled) {
    return "paid";
  }
  return due < today ? "late" : "pending";
}

/** Jour de la semaine, lundi = 0. */
function weekdayIndex(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Lundi de la semaine d'une date. */
export function startOfWeek(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

/** Les sept jours (lundi → dimanche) de la semaine d'une date. */
export function weekDays(date: string): string[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Semaines (lundi → dimanche) couvrant un mois « AAAA-MM ». */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const weeks: string[][] = [];
  for (let monday = startOfWeek(first); monday.slice(0, 7) <= month; monday = addDays(monday, 7)) {
    weeks.push(weekDays(monday));
  }
  return weeks;
}

/** Mois précédent ou suivant d'un mois « AAAA-MM ». */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « novembre 2026 ». */
export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${year}`;
}
