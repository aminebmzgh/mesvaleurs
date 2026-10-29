/**
 * Statistiques (spec §8) : dépenses par mois et par fournisseur, délai moyen de paiement par
 * fournisseur, répartition chèques / LCN / virements. Calculs en centimes.
 */

import { daysBetween } from "@/lib/dates";

export type StatPaymentType = "check" | "lcn" | "transfer";

export type StatPayment = {
  type: StatPaymentType;
  amount: number;
  issueDate: string;
  /** Date de paiement retenue : remise au fournisseur, à défaut émission. */
  paidOn: string;
  supplier: { id: string; name: string };
  /** Factures réglées : part affectée et date de la facture. */
  allocations: { amount: number; invoiceDate: string }[];
};

export type SupplierStat = { id: string; name: string; total: number; count: number; averageDelay: number | null };

export type Statistics = {
  total: number;
  count: number;
  byMonth: { month: string; total: number; count: number }[];
  bySupplier: SupplierStat[];
  byType: Record<StatPaymentType, { total: number; count: number; share: number }>;
  /** Délai moyen (jours) entre la facture et son paiement, pondéré par les montants réglés. */
  averageDelay: number | null;
};

const cents = (amount: number) => Math.round(amount * 100);

/** Mois « AAAA-MM » de `from` à `to` inclus. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.split("-").map(Number);
  const [endYear, endMonth] = to.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      [year, month] = [year + 1, 1];
    }
  }
  return months;
}

/** Moyenne pondérée de délais (jours), arrondie au jour ; null sans poids. */
function weightedDelay(samples: { days: number; weight: number }[]): number | null {
  const weight = samples.reduce((sum, s) => sum + s.weight, 0);
  return weight > 0 ? Math.round(samples.reduce((sum, s) => sum + s.days * s.weight, 0) / weight) : null;
}

export function computeStatistics(payments: StatPayment[], months: string[]): Statistics {
  const monthTotals = new Map(months.map((m) => [m, { total: 0, count: 0 }]));
  const suppliers = new Map<string, { id: string; name: string; total: number; count: number; delays: { days: number; weight: number }[] }>();
  const types: Record<StatPaymentType, { total: number; count: number }> = {
    check: { total: 0, count: 0 },
    lcn: { total: 0, count: 0 },
    transfer: { total: 0, count: 0 },
  };
  const allDelays: { days: number; weight: number }[] = [];
  let totalCents = 0;

  for (const payment of payments) {
    const amount = cents(payment.amount);
    totalCents += amount;
    const month = monthTotals.get(payment.issueDate.slice(0, 7));
    if (month) {
      month.total += amount;
      month.count += 1;
    }
    types[payment.type].total += amount;
    types[payment.type].count += 1;

    const supplier = suppliers.get(payment.supplier.id) ?? { ...payment.supplier, total: 0, count: 0, delays: [] };
    supplier.total += amount;
    supplier.count += 1;
    for (const allocation of payment.allocations) {
      // Un paiement antérieur à la facture (acompte) compte pour un délai nul
      const sample = { days: Math.max(daysBetween(allocation.invoiceDate, payment.paidOn), 0), weight: cents(allocation.amount) };
      supplier.delays.push(sample);
      allDelays.push(sample);
    }
    suppliers.set(payment.supplier.id, supplier);
  }

  const share = (part: number) => (totalCents > 0 ? Math.round((part / totalCents) * 1000) / 10 : 0);
  return {
    total: totalCents / 100,
    count: payments.length,
    byMonth: months.map((month) => ({ month, total: monthTotals.get(month)!.total / 100, count: monthTotals.get(month)!.count })),
    bySupplier: [...suppliers.values()]
      .map((s) => ({ id: s.id, name: s.name, total: s.total / 100, count: s.count, averageDelay: weightedDelay(s.delays) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "fr")),
    byType: Object.fromEntries(
      (Object.keys(types) as StatPaymentType[]).map((type) => [type, { total: types[type].total / 100, count: types[type].count, share: share(types[type].total) }]),
    ) as Statistics["byType"],
    averageDelay: weightedDelay(allDelays),
  };
}

/** Les `limit` premiers fournisseurs, les suivants regroupés en « Autres ». */
export function topSuppliers(stats: SupplierStat[], limit = 8): { name: string; total: number; other: boolean }[] {
  const top = stats.slice(0, limit).map((s) => ({ name: s.name, total: s.total, other: false }));
  const rest = stats.slice(limit);
  if (rest.length > 0) {
    top.push({ name: `Autres (${rest.length})`, total: rest.reduce((sum, s) => sum + cents(s.total), 0) / 100, other: true });
  }
  return top;
}
