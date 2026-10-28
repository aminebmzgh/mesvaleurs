/** Présentation des entrées du journal d'audit : libellés, résumé de l'objet, champs modifiés. */

import { CHECKBOOK_STATUS_LABELS, formatInstrumentNumber } from "@/lib/checkbooks";
import { formatDate, formatMAD } from "@/lib/format";
import { INVOICE_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, type PaymentType } from "@/lib/labels";

type Row = Record<string, unknown>;

export const ACTION_LABELS: Record<string, string> = {
  insert: "Création",
  update: "Modification",
  delete: "Suppression",
  issue: "Émission",
  print: "Impression",
  reprint: "Réimpression",
  manual_match: "Rapprochement manuel",
  unmatch: "Rapprochement défait",
  reject: "Rejet",
  regularize: "Régularisation",
  postpone: "Report d'échéance",
};

/** Regroupements proposés dans le filtre « Action ». */
export const ACTION_FILTERS = [
  "insert",
  "update",
  "delete",
  "issue",
  "print",
  "reprint",
  "manual_match",
  "unmatch",
  "reject",
  "regularize",
  "postpone",
] as const;

export const TABLE_LABELS: Record<string, string> = {
  organizations: "Entreprise",
  memberships: "Membre",
  invitations: "Invitation",
  banks: "Banque",
  bank_accounts: "Compte bancaire",
  checkbooks: "Chéquier ou carnet",
  print_templates: "Modèle d'impression",
  print_batches: "Lot d'impression",
  suppliers: "Fournisseur",
  invoices: "Facture",
  payments: "Paiement",
  payment_allocations: "Affectation à une facture",
  statement_imports: "Relevé importé",
  statement_column_mappings: "Correspondance de colonnes",
  statement_lines: "Ligne de relevé",
  letter_templates: "Modèle de lettre",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function tableLabel(table: string | null): string {
  return table ? (TABLE_LABELS[table] ?? table) : "—";
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  label: "Libellé",
  status: "Statut",
  amount: "Montant",
  number: "Numéro",
  type: "Type",
  role: "Rôle",
  email: "E-mail",
  payee_name: "Bénéficiaire",
  issue_date: "Date d'émission",
  issue_place: "Lieu d'émission",
  due_date: "Échéance",
  delivered_at: "Remis le",
  debited_at: "Débité le",
  cancelled_at: "Annulé le",
  cancellation_reason: "Motif d'annulation",
  rejection_reason: "Motif de rejet",
  amount_excl_tax: "Montant HT",
  vat_amount: "TVA",
  amount_incl_tax: "Montant TTC",
  amount_paid: "Réglé",
  amount_cashed: "Encaissé",
  payment_terms_days: "Délai convenu",
  legal_due_date: "Date limite légale",
  is_active: "Actif",
  rib: "RIB",
  reference: "Référence",
  branch: "Agence",
  address: "Adresse",
  city: "Ville",
  phone: "Téléphone",
  contact_name: "Contact",
  tax_id: "IF",
  trade_register: "RC",
  print_cover_letter: "Lettre d'accompagnement",
  number_width: "Chiffres du numéro",
  received_at: "Reçu le",
  print_template_id: "Modèle d'impression",
  bank_id: "Banque",
  bank_account_id: "Compte bancaire",
  supplier_id: "Fournisseur",
  checkbook_id: "Chéquier",
  invoice_id: "Facture",
  user_id: "Utilisateur",
  accepted_at: "Acceptée le",
  expires_at: "Expire le",
  short_name: "Sigle",
  period_start: "Début de période",
  period_end: "Fin de période",
  line_count: "Lignes",
  ice: "ICE",
  notes: "Notes",
  first_number: "Premier numéro",
  last_number: "Dernier numéro",
  next_number: "Prochain numéro",
  zones: "Zones",
  options: "Options",
  offset_x_mm: "Décalage horizontal",
  offset_y_mm: "Décalage vertical",
  current_balance: "Solde courant",
  opening_balance: "Solde d'ouverture",
  print_count: "Impressions",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

// Colonnes techniques, sans intérêt pour l'utilisateur
const IGNORED_FIELDS = new Set(["id", "organization_id", "created_at", "updated_at", "created_by"]);

export type FieldChange = { field: string; before: unknown; after: unknown };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Champs modifiés entre deux états d'une ligne. Création : champs renseignés ;
 * suppression : champs de la ligne supprimée.
 */
export function changedFields(before: Row | null, after: Row | null): FieldChange[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: FieldChange[] = [];
  for (const field of keys) {
    if (IGNORED_FIELDS.has(field)) {
      continue;
    }
    const old = before?.[field] ?? null;
    const now = after?.[field] ?? null;
    if (before && after ? !same(old, now) : old !== null || now !== null) {
      changes.push({ field, before: old, after: now });
    }
  }
  return changes;
}

// Libellés des statuts, selon la table
const STATUS_LABELS: Record<string, Record<string, string>> = {
  payments: PAYMENT_STATUS_LABELS,
  invoices: INVOICE_STATUS_LABELS,
  checkbooks: CHECKBOOK_STATUS_LABELS,
};

/** Valeur lisible d'un champ du journal. */
export function formatValue(table: string | null, field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }
  if (typeof value === "string") {
    const labels: Record<string, string> | undefined = field === "status" && table ? STATUS_LABELS[table] : field === "type" ? PAYMENT_TYPE_LABELS : undefined;
    if (labels?.[value]) {
      return labels[value];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return formatDate(value);
    }
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Désignation courte de l'objet concerné (« Chèque n° 0001003 », nom du fournisseur…). */
export function describeRecord(table: string | null, before: Row | null, after: Row | null, details: Row | null): string {
  // Action métier sans état de ligne : la désignation vient du détail
  const row = after ?? before ?? details ?? {};
  const text = (key: string) => (typeof row[key] === "string" && row[key] ? (row[key] as string) : null);
  switch (table) {
    case "payments": {
      const type = PAYMENT_TYPE_LABELS[row.type as PaymentType] ?? "Paiement";
      if (typeof row.number === "number") {
        return `${type} n° ${formatInstrumentNumber(row.number, 7)}`;
      }
      return text("reference") ? `${type} ${text("reference")}` : type;
    }
    case "invoices":
      return text("number") ? `Facture ${text("number")}` : "Facture";
    case "checkbooks":
      return typeof row.first_number === "number" && typeof row.last_number === "number"
        ? `N° ${row.first_number} à ${row.last_number}`
        : "Chéquier";
    case "invitations":
      return text("email") ?? "Invitation";
    case "print_batches":
      return typeof details?.first_number === "number" && typeof details?.last_number === "number"
        ? `Formules n° ${details.first_number} à ${details.last_number}`
        : "Lot d'impression";
    case "payment_allocations":
      return typeof row.amount === "number" ? `${formatMAD(row.amount)} affectés` : "Affectation";
    case "statement_imports":
      return text("period_start") && text("period_end")
        ? `Relevé du ${formatDate(text("period_start")!)} au ${formatDate(text("period_end")!)}`
        : "Relevé importé";
    default:
      return text("name") ?? text("label") ?? tableLabel(table);
  }
}

/** Écran de l'objet concerné, s'il existe. */
export function recordHref(table: string | null, recordId: string | null, before: Row | null, after: Row | null): string | null {
  const row = after ?? before ?? {};
  const id = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : null);
  // Objet supprimé : plus d'écran à ouvrir
  if (!recordId || (!after && table !== "print_batches" && table !== "statement_lines")) {
    return null;
  }
  switch (table) {
    case "suppliers":
      return `/fournisseurs/${recordId}`;
    case "invoices":
      return `/factures/${recordId}`;
    case "bank_accounts":
      return `/comptes-bancaires/${recordId}`;
    case "print_templates":
      return `/comptes-bancaires/modeles/${recordId}`;
    case "print_batches":
      return `/paiements/lots/${recordId}`;
    case "statement_imports":
      return `/rapprochement/${recordId}`;
    case "checkbooks":
      return id("bank_account_id") ? `/comptes-bancaires/${id("bank_account_id")}` : null;
    case "payments":
      return id("print_batch_id") ? `/paiements/lots/${id("print_batch_id")}` : null;
    case "payment_allocations":
      return id("invoice_id") ? `/factures/${id("invoice_id")}` : null;
    default:
      return null;
  }
}
