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

export type StockBook = { bankAccountId: string; type: InstrumentType; status: CheckbookStatus; remaining: number };

/**
 * Stock de formules par compte et par type (spec §11 bis H) : somme des carnets en
 * service. Un compte est « presque épuisé » quand ce total atteint le seuil — un carnet
 * qui s'achève ne déclenche pas d'alerte si un autre carnet en service prend le relais.
 */
export function stockByAccount(books: StockBook[], threshold: number) {
  const groups = new Map<string, { bankAccountId: string; type: InstrumentType; remaining: number; low: boolean }>();
  for (const book of books.filter((b) => b.status === "active")) {
    const key = `${book.bankAccountId}:${book.type}`;
    const group = groups.get(key) ?? { bankAccountId: book.bankAccountId, type: book.type, remaining: 0, low: false };
    group.remaining += book.remaining;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, low: group.remaining <= threshold }));
}

/** Le stock du compte pour ce type de carnet est-il presque épuisé ? */
export function isLowStock(books: StockBook[], threshold: number, bankAccountId: string, type: InstrumentType): boolean {
  return stockByAccount(books, threshold).some((g) => g.bankAccountId === bankAccountId && g.type === type && g.low);
}

/** État d'une formule dans l'inventaire d'un carnet. */
export type FormStatus = "used" | "cancelled" | "stopped" | "remaining" | "skipped";

export const FORM_STATUS_LABELS: Record<FormStatus, string> = {
  used: "Utilisée",
  cancelled: "Annulée",
  stopped: "En opposition",
  remaining: "Restante",
  skipped: "Non attribuée",
};

type InventoryPayment = { number: number; status: string; guaranteeClosed?: boolean };

export type InventoryRow<P> = { first: number; last: number; status: FormStatus; payment: P | null };

/**
 * Inventaire d'un carnet (spec §11 bis H) : chaque numéro est utilisé (paiement émis,
 * chèque de garantie restitué compris), annulé, en opposition (paiement ou formule
 * vierge), restant, ou non attribué (avant le prochain numéro, sans paiement : anomalie).
 * Les numéros consécutifs sans paiement de même état sont regroupés en plages.
 */
export function checkbookInventory<P extends InventoryPayment>(
  book: { firstNumber: number; lastNumber: number; nextNumber: number },
  payments: P[],
  stopped: StoppedRange[],
): { rows: InventoryRow<P>[]; counts: Record<FormStatus, number> } {
  const byNumber = new Map(payments.map((p) => [p.number, p]));
  const counts: Record<FormStatus, number> = { used: 0, cancelled: 0, stopped: 0, remaining: 0, skipped: 0 };
  const rows: InventoryRow<P>[] = [];
  for (let n = book.firstNumber; n <= book.lastNumber; n += 1) {
    const payment = byNumber.get(n) ?? null;
    let status: FormStatus;
    if (payment) {
      status =
        payment.status === "stopped" ? "stopped" : payment.status === "cancelled" && !payment.guaranteeClosed ? "cancelled" : "used";
    } else if (isStopped(n, stopped)) {
      status = "stopped";
    } else {
      status = n >= book.nextNumber ? "remaining" : "skipped";
    }
    counts[status] += 1;
    const previous = rows.at(-1);
    if (!payment && previous && !previous.payment && previous.status === status && previous.last === n - 1) {
      previous.last = n;
    } else {
      rows.push({ first: n, last: n, status, payment });
    }
  }
  return { rows, counts };
}
