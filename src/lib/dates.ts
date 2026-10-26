/** Dates métier, toujours exprimées dans le fuseau de l'entreprise (Africa/Casablanca). */

/** Date du jour au format ISO (AAAA-MM-JJ) dans le fuseau donné. */
export function todayIso(timeZone = "Africa/Casablanca", now: Date = new Date()): string {
  // Le format suédois produit directement AAAA-MM-JJ
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Nombre de jours entre deux dates ISO (positif si `to` est après `from`). */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Ajoute des jours à une date ISO. */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
