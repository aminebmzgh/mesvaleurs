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

/** Instant (ISO, UTC) du début de la journée `date` dans le fuseau donné, heure d'été comprise. */
export function dayStartInstant(date: string, timeZone = "Africa/Casablanca"): string {
  const guess = Date.parse(`${date}T00:00:00Z`);
  // Décalage du fuseau à cet instant : heure locale lue comme si elle était UTC, moins l'instant
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(guess);
  const offset = Date.parse(`${parts.replace(" ", "T")}Z`) - guess;
  return new Date(guess - offset).toISOString();
}
