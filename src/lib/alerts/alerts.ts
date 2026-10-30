/**
 * Alertes de l'entreprise (spec §8) : la même liste alimente la page Alertes et le
 * récapitulatif quotidien envoyé par e-mail. Construite à partir des indicateurs du
 * tableau de bord, du plus urgent au moins urgent.
 */

import { formatDate, formatMAD } from "@/lib/format";
import { REJECTION_KIND_LABELS, type RejectionKind } from "@/lib/labels";
import { countdownLabel, type RegularizationState } from "@/lib/payments/rejections";

export type AlertSeverity = "critical" | "warning" | "info";

export type AlertKind =
  | "rejected"
  | "insufficient_funds"
  | "lcn_due"
  | "invoice_overdue"
  | "invoice_due"
  | "guarantee_return"
  | "uncashed"
  | "low_stock"
  | "pending_batches";

export type AlertItem = { label: string; detail: string; badge?: string; overdue?: boolean };

export type AppAlert = {
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  /** Page où traiter l'alerte (chemin de l'application). */
  href: string;
  action: string;
  items: AlertItem[];
};

/** Indicateurs utilisés (sous-ensemble du tableau de bord). */
export type AlertSource = {
  pendingBatchCount: number;
  insufficientAccounts: { id: string; label: string; current_balance: number; circulation: number; projected: number }[];
  lcnDue: { id: string; number: string; supplier: string; amount: number; dueDate: string; daysLeft: number }[];
  overdue: { id: string; number: string; supplier: string; remaining: number; daysLate: number }[];
  invoicesDue: { days: number; invoices: { id: string; number: string; supplier: string; remaining: number; legalDueDate: string; daysLeft: number }[] };
  rejected: { id: string; label: string; supplier: string; amount: number; kind: RejectionKind | null; state: RegularizationState }[];
  uncashed: { days: number; count: number; total: number };
  guaranteesToRecover: { id: string; label: string; supplier: string; amount: number; returnDue: string; daysLeft: number }[];
  lowStock: { id: string; bankAccountId: string; type: "check" | "lcn"; remaining: number; account: string }[];
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

const plural = (count: number, singular: string, pluralForm = `${singular}s`) => (count > 1 ? pluralForm : singular);
const total = (amounts: number[]) => Math.round(amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0)) / 100;

export function buildAlerts(source: AlertSource, { lcnAlertDays }: { lcnAlertDays: number }): AppAlert[] {
  const alerts: AppAlert[] = [];

  if (source.rejected.length > 0) {
    const count = source.rejected.length;
    alerts.push({
      kind: "rejected",
      severity: "critical",
      title: `${count} ${plural(count, "paiement rejeté")} à régulariser`,
      detail: "Délai de régularisation des chèques sans provision (loi 71-24, informations indicatives).",
      href: "/paiements?statut=rejected",
      action: "Régulariser",
      items: source.rejected.map((p) => ({
        label: p.label,
        detail: [p.supplier, formatMAD(p.amount), p.kind ? REJECTION_KIND_LABELS[p.kind].toLowerCase() : null].filter(Boolean).join(" · "),
        badge: countdownLabel(p.state) + (p.state.kind === "pending" || p.state.kind === "overdue" ? ` · ${formatDate(p.state.dueDate)}` : ""),
        overdue: p.state.kind === "overdue",
      })),
    });
  }

  for (const account of source.insufficientAccounts) {
    alerts.push({
      kind: "insufficient_funds",
      severity: "critical",
      title: `Provision insuffisante : ${account.label}`,
      detail: `Chèques et LCN en circulation (${formatMAD(account.circulation)}) au-delà du solde (${formatMAD(account.current_balance)}). Solde prévisionnel : ${formatMAD(account.projected)}.`,
      href: "/tresorerie",
      action: "Voir la prévision de trésorerie",
      items: [],
    });
  }

  const lcn = source.lcnDue.filter((p) => p.daysLeft <= lcnAlertDays);
  if (lcn.length > 0) {
    alerts.push({
      kind: "lcn_due",
      severity: "warning",
      title: `${lcn.length} LCN à échoir sous ${lcnAlertDays} jours`,
      detail: `${formatMAD(total(lcn.map((p) => p.amount)))} à provisionner.`,
      href: "/calendrier",
      action: "Voir le calendrier",
      items: lcn.map((p) => ({
        label: `LCN ${p.number}`,
        detail: `${p.supplier} · ${formatMAD(p.amount)}`,
        badge: p.daysLeft < 0 ? `échue depuis ${-p.daysLeft} j` : p.daysLeft === 0 ? "aujourd'hui" : `${formatDate(p.dueDate)} · J-${p.daysLeft}`,
        overdue: p.daysLeft < 0,
      })),
    });
  }

  if (source.overdue.length > 0) {
    const count = source.overdue.length;
    alerts.push({
      kind: "invoice_overdue",
      severity: "warning",
      title: `${count} ${plural(count, "facture")} en retard`,
      detail: `Date limite légale dépassée (loi 69-21, calcul indicatif) · ${formatMAD(total(source.overdue.map((i) => i.remaining)))} restant dû.`,
      href: "/factures",
      action: "Voir les factures",
      items: source.overdue.map((i) => ({
        label: i.number,
        detail: `${i.supplier} · ${formatMAD(i.remaining)}`,
        badge: `${i.daysLate} j de retard`,
        overdue: true,
      })),
    });
  }

  if (source.invoicesDue.invoices.length > 0) {
    const invoices = source.invoicesDue.invoices;
    alerts.push({
      kind: "invoice_due",
      severity: "warning",
      title: `${invoices.length} ${plural(invoices.length, "facture")} à payer sous ${source.invoicesDue.days} jours`,
      detail: `Date limite légale proche (loi 69-21, calcul indicatif) · ${formatMAD(total(invoices.map((i) => i.remaining)))} restant dû.`,
      href: "/paiements/nouveau",
      action: "Préparer un paiement",
      items: invoices.map((i) => ({
        label: i.number,
        detail: `${i.supplier} · ${formatMAD(i.remaining)}`,
        badge: i.daysLeft === 0 ? "aujourd'hui" : `${formatDate(i.legalDueDate)} · J-${i.daysLeft}`,
      })),
    });
  }

  if (source.guaranteesToRecover.length > 0) {
    alerts.push({
      kind: "guarantee_return",
      severity: "warning",
      title: "Chèques de garantie à récupérer",
      href: "/paiements?type=guarantee_check",
      action: "Voir les chèques de garantie",
      items: source.guaranteesToRecover.map((g) => ({
        label: g.label,
        detail: `${g.supplier} · ${formatMAD(g.amount)}`,
        badge: g.daysLeft < 0 ? `restitution dépassée de ${-g.daysLeft} j` : `restitution le ${formatDate(g.returnDue)}`,
        overdue: g.daysLeft < 0,
      })),
    });
  }

  if (source.uncashed.count > 0) {
    const count = source.uncashed.count;
    alerts.push({
      kind: "uncashed",
      severity: "info",
      title: `${count} ${plural(count, "chèque non encaissé", "chèques non encaissés")} depuis plus de ${source.uncashed.days} jours`,
      detail: `${formatMAD(source.uncashed.total)} restent bloqués dans le solde prévisionnel.`,
      href: "/paiements/non-encaisses",
      action: "Relancer les fournisseurs",
      items: [],
    });
  }

  for (const book of source.lowStock) {
    alerts.push({
      kind: "low_stock",
      severity: "info",
      title: `${book.type === "lcn" ? "Carnet de LCN" : "Chéquier"} presque épuisé : ${book.account}`,
      detail: `${book.remaining} ${plural(book.remaining, "formule restante", "formules restantes")}. Commandez un nouveau carnet à votre banque.`,
      href: `/comptes-bancaires/${book.bankAccountId}`,
      action: "Enregistrer un carnet",
      items: [],
    });
  }

  if (source.pendingBatchCount > 0) {
    const count = source.pendingBatchCount;
    alerts.push({
      kind: "pending_batches",
      severity: "info",
      title: `${count} ${plural(count, "lot")} à valider avant impression`,
      href: "/paiements/a-valider",
      action: "Voir les lots à valider",
      items: [],
    });
  }

  // Tri stable : gravité, puis ordre de construction
  return alerts.map((alert, index) => ({ alert, index })).sort((a, b) => SEVERITY_ORDER[a.alert.severity] - SEVERITY_ORDER[b.alert.severity] || a.index - b.index).map(({ alert }) => alert);
}

/** Nombre d'alertes par gravité. */
export function countBySeverity(alerts: AppAlert[]): Record<AlertSeverity, number> {
  return {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };
}
