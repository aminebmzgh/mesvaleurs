/**
 * Prévision de trésorerie (spec §8) : solde actuel − chèques en circulation − LCN à
 * échoir, jour par jour. Calculs en centimes.
 */

import { addDays } from "@/lib/dates";

export type MovementKind = "check" | "lcn" | "transfer" | "invoice";

export type ForecastMovement = {
  /** Date prévue du débit (échéance de la LCN, date du virement, échéance de la facture). */
  date: string;
  /** Montant débité, positif. */
  amount: number;
  kind: MovementKind;
  label: string;
  supplier: string;
  href: string;
};

export type ForecastDay = { date: string; balance: number; outflow: number; movements: ForecastMovement[] };

export type Forecast = {
  days: ForecastDay[];
  openingBalance: number;
  endBalance: number;
  low: { date: string; balance: number };
  /** Premier jour où le solde prévisionnel devient négatif. */
  firstNegative: { date: string; balance: number } | null;
};

export const FORECAST_HORIZON_DAYS = 90;

/**
 * Date de débit prévue : un chèque en circulation peut être présenté à tout moment (débit
 * compté aujourd'hui) ; une LCN, un virement ou une facture à leur date, ou aujourd'hui si
 * elle est passée.
 */
export function plannedDate(kind: MovementKind, date: string | null, today: string): string {
  if (kind === "check" || !date || date < today) {
    return today;
  }
  return date;
}

const cents = (amount: number) => Math.round(amount * 100);

/** Solde de chaque jour, d'aujourd'hui à l'horizon (inclus) ; les débits au-delà sont ignorés. */
export function buildForecast(openingBalance: number, movements: ForecastMovement[], today: string, horizonDays = FORECAST_HORIZON_DAYS): Forecast {
  const byDate = new Map<string, ForecastMovement[]>();
  for (const movement of movements) {
    const list = byDate.get(movement.date) ?? [];
    list.push(movement);
    byDate.set(movement.date, list);
  }

  const days: ForecastDay[] = [];
  let balanceCents = cents(openingBalance);
  for (let i = 0; i <= horizonDays; i += 1) {
    const date = addDays(today, i);
    const dayMovements = (byDate.get(date) ?? []).sort((a, b) => b.amount - a.amount);
    const outflowCents = dayMovements.reduce((sum, m) => sum + cents(m.amount), 0);
    balanceCents -= outflowCents;
    days.push({ date, balance: balanceCents / 100, outflow: outflowCents / 100, movements: dayMovements });
  }

  const low = days.reduce((min, day) => (day.balance < min.balance ? day : min), days[0]);
  const negative = days.find((day) => day.balance < 0);
  return {
    days,
    openingBalance,
    endBalance: days.at(-1)!.balance,
    low: { date: low.date, balance: low.balance },
    firstNegative: negative ? { date: negative.date, balance: negative.balance } : null,
  };
}
