/**
 * Offres de MesValeurs (#43) : prix, limites et fonctionnalités incluses. Fichier de
 * réglages unique : pour changer une offre, modifier ce fichier.
 * Les limites chiffrées et la double signature sont aussi appliquées par la base
 * (private.plan_limits, migration des abonnements) : un test vérifie que les deux
 * concordent ; une nouvelle valeur demande donc une migration qui redéfinit plan_limits.
 */

export const PLAN_IDS = ["free", "pro", "business", "cabinet"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type Plan = {
  id: PlanId;
  label: string;
  tagline: string;
  /** Prix mensuel hors taxes (DH). */
  monthlyPrice: number;
  /** null = illimité. */
  maxBankAccounts: number | null;
  maxMembers: number | null;
  maxMonthlyPayments: number | null;
  /** Lectures et questions d'IA par mois et par entreprise (0 = IA non incluse). */
  aiMonthlyQuota: number;
  /** Offre Cabinet : entreprises clientes incluses, puis prix de chaque entreprise en plus. */
  includedClients?: number;
  extraClientPrice?: number;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Gratuit",
    tagline: "Pour émettre ses chèques et LCN correctement, en toute conformité.",
    monthlyPrice: 0,
    maxBankAccounts: 1,
    maxMembers: 1,
    maxMonthlyPayments: 10,
    aiMonthlyQuota: 0,
  },
  pro: {
    id: "pro",
    label: "Pro",
    tagline: "Pour gagner du temps : imports automatiques, documents, e-mails et trésorerie.",
    monthlyPrice: 290,
    maxBankAccounts: 2,
    maxMembers: 3,
    maxMonthlyPayments: null,
    aiMonthlyQuota: 100,
  },
  business: {
    id: "business",
    label: "Business",
    tagline: "Pour garder le contrôle : double signature, journal d'audit, archivage légal.",
    monthlyPrice: 690,
    maxBankAccounts: null,
    maxMembers: null,
    maxMonthlyPayments: null,
    aiMonthlyQuota: 500,
  },
  cabinet: {
    id: "cabinet",
    label: "Cabinet",
    tagline: "Pour les cabinets comptables : tous vos clients, une vue consolidée.",
    monthlyPrice: 1490,
    maxBankAccounts: null,
    maxMembers: null,
    maxMonthlyPayments: null,
    aiMonthlyQuota: 500,
    includedClients: 15,
    extraClientPrice: 80,
  },
};

/** Paiement annuel : 2 mois offerts. */
export const ANNUAL_MONTHS_BILLED = 10;
/** Essai offert à chaque nouvelle entreprise (cf. private.start_trial). */
export const TRIAL_DAYS = 14;
export const TRIAL_PLAN: PlanId = "business";
/** Adresse commerciale, pour changer d'offre en attendant le paiement en ligne. */
export const SALES_EMAIL = "contact@mesvaleurs.ma";

/** Chaque offre comprend celles de rang inférieur. */
const RANK: Record<PlanId, number> = { free: 0, pro: 1, business: 2, cabinet: 3 };

export type FeatureGroup = "payments" | "printing" | "checkbooks" | "reconciliation" | "invoices" | "tracking" | "ai" | "security";

export type Feature = { label: string; group: FeatureGroup; minPlan: PlanId };

/** Fonctionnalités dont l'accès dépend de l'offre, avec l'offre minimale qui les comprend. */
export const FEATURES = {
  guarantees: { label: "Chèques de garantie", group: "payments", minPlan: "pro" },
  lcn_postpone: { label: "Report d'échéance des LCN", group: "payments", minPlan: "pro" },
  uncashed: { label: "Chèques non encaissés depuis longtemps", group: "payments", minPlan: "pro" },
  optimizer: { label: "Plan de paiement", group: "payments", minPlan: "business" },
  approvals: { label: "Double signature et plafonds", group: "payments", minPlan: "business" },
  print_extras: { label: "Talons, enveloppes et mention « non endossable »", group: "printing", minPlan: "pro" },
  letters: { label: "Lettre d'accompagnement et bordereau de remise", group: "printing", minPlan: "pro" },
  standard_letters: { label: "Courriers types", group: "printing", minPlan: "pro" },
  letter_templates: { label: "Modèles de lettres personnalisés", group: "printing", minPlan: "business" },
  receipts: { label: "Accusé de réception signé à l'écran", group: "printing", minPlan: "pro" },
  cheque_scan: { label: "Lecture du premier chèque par photo", group: "checkbooks", minPlan: "pro" },
  statement_pdf: { label: "Import des relevés PDF", group: "reconciliation", minPlan: "pro" },
  statement_ocr: { label: "Relevés scannés et photos", group: "reconciliation", minPlan: "pro" },
  statement_inbox: { label: "Relevés reçus par e-mail", group: "reconciliation", minPlan: "pro" },
  supplier_reconciliation: { label: "Rapprochement avec le relevé d'un fournisseur", group: "reconciliation", minPlan: "pro" },
  invoice_import: { label: "Import de factures Excel et CSV", group: "invoices", minPlan: "pro" },
  ubl: { label: "Factures électroniques UBL", group: "invoices", minPlan: "business" },
  archive: { label: "Archivage légal des factures", group: "invoices", minPlan: "business" },
  alert_emails: { label: "Récapitulatif des alertes par e-mail", group: "tracking", minPlan: "pro" },
  monthly_summary: { label: "Résumé mensuel par e-mail", group: "tracking", minPlan: "pro" },
  forecast: { label: "Prévision de trésorerie", group: "tracking", minPlan: "pro" },
  calendar: { label: "Calendrier des échéances", group: "tracking", minPlan: "pro" },
  statistics: { label: "Statistiques", group: "tracking", minPlan: "pro" },
  accounting_export: { label: "Export comptable mensuel", group: "tracking", minPlan: "pro" },
  audit_journal: { label: "Journal d'audit", group: "tracking", minPlan: "business" },
  consolidated: { label: "Vue consolidée des clients", group: "tracking", minPlan: "cabinet" },
  ai: { label: "Lecture de factures et assistant IA", group: "ai", minPlan: "pro" },
} as const satisfies Record<string, Feature>;

export type FeatureKey = keyof typeof FEATURES;

/** Fonctionnalités comprises dans toutes les offres (page des tarifs). */
export const INCLUDED_EVERYWHERE: { label: string; group: FeatureGroup }[] = [
  { label: "Fournisseurs et factures, date limite légale", group: "payments" },
  { label: "Assistant de paiement : chèques, LCN, montant en lettres", group: "payments" },
  { label: "Virements fournisseurs", group: "payments" },
  { label: "Chèques et LCN rejetés (loi 71-24), oppositions", group: "payments" },
  { label: "Impression au millimètre, modèles des banques marocaines", group: "printing" },
  { label: "Éditeur visuel de modèle d'impression", group: "printing" },
  { label: "Chéquiers et carnets de LCN, stock, inventaire", group: "checkbooks" },
  { label: "Import de relevés Excel et CSV, rapprochement bancaire", group: "reconciliation" },
  { label: "Tableau de bord et alertes dans l'application", group: "tracking" },
  { label: "Délais de paiement (loi 69-21)", group: "tracking" },
  { label: "Rapport de fin de mois, exports CSV", group: "tracking" },
  { label: "Double authentification, application installable", group: "security" },
];

export const FEATURE_GROUP_LABELS: Record<FeatureGroup, string> = {
  payments: "Paiements fournisseurs",
  printing: "Impression et documents",
  checkbooks: "Chéquiers",
  reconciliation: "Rapprochement bancaire",
  invoices: "Factures",
  tracking: "Trésorerie, suivi et rapports",
  ai: "Intelligence artificielle",
  security: "Sécurité et confort",
};

export function hasFeature(plan: PlanId, feature: FeatureKey): boolean {
  return RANK[plan] >= RANK[FEATURES[feature].minPlan];
}

/** Offre en vigueur : Business pendant l'essai, sinon l'offre souscrite (cf. private.effective_plan). */
export function effectivePlan(subscription: { plan: string; trial_ends_at: string | null } | null, now = new Date()): PlanId {
  if (subscription?.trial_ends_at && new Date(subscription.trial_ends_at) > now) {
    return TRIAL_PLAN;
  }
  return isPlanId(subscription?.plan) ? subscription.plan : "free";
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/** Jours d'essai restants (arrondis au jour supérieur), ou null hors essai. */
export function trialDaysLeft(trialEndsAt: string | null, now = new Date()): number | null {
  if (!trialEndsAt) {
    return null;
  }
  const ms = new Date(trialEndsAt).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : null;
}

/** Message affiché quand une fonctionnalité n'est pas comprise dans l'offre. */
export function upgradeMessage(feature: FeatureKey): string {
  const { label, minPlan } = FEATURES[feature];
  return `${label} : fonctionnalité de l'offre ${PLANS[minPlan].label}. Changez d'offre depuis Paramètres › Abonnement.`;
}

/** Quota d'IA du mois : celui choisi par l'entreprise, dans la limite de son offre. */
export function aiQuotaFor(plan: PlanId, chosen: number): number {
  return Math.min(chosen, PLANS[plan].aiMonthlyQuota);
}
