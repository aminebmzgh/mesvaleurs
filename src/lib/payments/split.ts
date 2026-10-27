/**
 * Répartition d'un règlement en plusieurs chèques ou LCN, et affectation des
 * paiements aux factures. Tous les calculs se font en centimes (entiers).
 */

import { addDays } from "@/lib/dates";

/** Nombre maximal de formules émises en une fois. */
export const MAX_INSTRUMENTS = 24;

/**
 * Parts égales : total ÷ nombre, l'écart d'arrondi (centimes) va sur la dernière.
 * 100,00 DH en 3 → 33,33 + 33,33 + 33,34.
 */
export function splitEqual(totalCents: number, count: number): number[] {
  assertCount(count);
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new RangeError("Le montant total doit être un nombre de centimes positif.");
  }
  if (totalCents < count) {
    throw new RangeError("Le montant est trop faible pour être réparti en autant de formules.");
  }
  const share = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, index) => (index === count - 1 ? totalCents - share * (count - 1) : share));
}

export type CustomSplitCheck = { ok: true } | { ok: false; difference: number; invalidIndexes: number[] };

/** Répartition personnalisée : chaque part positive et somme égale au total. */
export function checkCustomSplit(totalCents: number, parts: number[]): CustomSplitCheck {
  assertCount(parts.length);
  const invalidIndexes = parts.flatMap((part, index) => (Number.isInteger(part) && part > 0 ? [] : [index]));
  const difference = totalCents - parts.reduce((sum, part) => sum + (Number.isInteger(part) ? part : 0), 0);
  return invalidIndexes.length === 0 && difference === 0 ? { ok: true } : { ok: false, difference, invalidIndexes };
}

/**
 * Échéancier de LCN : une échéance tous les `intervalDays` jours à compter de la
 * date de départ (30/60/90 jours par défaut), la première après un intervalle.
 */
export function scheduleDueDates(startDate: string, count: number, intervalDays = 30, firstOffsetDays = intervalDays): string[] {
  assertCount(count);
  if (!Number.isInteger(intervalDays) || intervalDays < 0 || !Number.isInteger(firstOffsetDays) || firstOffsetDays < 0) {
    throw new RangeError("L'intervalle entre échéances doit être un nombre de jours positif.");
  }
  return Array.from({ length: count }, (_, index) => addDays(startDate, firstOffsetDays + index * intervalDays));
}

export type InvoiceDue = { invoiceId: string; dueCents: number };
export type Allocation = { paymentIndex: number; invoiceId: string; amountCents: number };

/**
 * Affecte les paiements aux factures, dans l'ordre (factures les plus anciennes en
 * premier) : chaque paiement solde la facture en cours avant de passer à la suivante.
 * Un éventuel excédent (paiement supérieur au reste dû total) est affecté à la
 * dernière facture, pour que tout montant émis reste rattaché à une facture.
 */
export function allocatePayments(paymentCents: number[], invoices: InvoiceDue[]): Allocation[] {
  if (invoices.length === 0) {
    return [];
  }
  const remaining = invoices.map((invoice) => Math.max(invoice.dueCents, 0));
  const allocations: Allocation[] = [];
  let invoiceIndex = 0;

  paymentCents.forEach((amount, paymentIndex) => {
    let left = amount;
    while (left > 0) {
      // Factures soldées : on passe à la suivante (la dernière absorbe l'excédent)
      while (invoiceIndex < invoices.length - 1 && remaining[invoiceIndex] === 0) {
        invoiceIndex += 1;
      }
      const isLast = invoiceIndex === invoices.length - 1;
      const take = isLast ? left : Math.min(left, remaining[invoiceIndex]);
      const invoiceId = invoices[invoiceIndex].invoiceId;
      const existing = allocations.find((a) => a.paymentIndex === paymentIndex && a.invoiceId === invoiceId);
      if (existing) {
        existing.amountCents += take;
      } else {
        allocations.push({ paymentIndex, invoiceId, amountCents: take });
      }
      remaining[invoiceIndex] = Math.max(remaining[invoiceIndex] - take, 0);
      left -= take;
    }
  });
  return allocations;
}

function assertCount(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTRUMENTS) {
    throw new RangeError(`Le nombre de formules doit être compris entre 1 et ${MAX_INSTRUMENTS}.`);
  }
}
