import "server-only";
import { requireRole } from "@/lib/auth/dal";
import { addDays, dayStartInstant } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/app";
import { ACTION_FILTERS, TABLE_LABELS } from "./entries";

/** Rôles qui consultent le journal (même règle que la politique RLS de `audit_log`). */
export const AUDIT_READER_ROLES: AppRole[] = ["admin", "manager", "accountant", "external_accountant"];

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_LIMIT = 5000;

export type AuditFilters = {
  from?: string;
  to?: string;
  actorId?: string;
  table?: string;
  action?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/** Filtres lus dans l'URL ; les valeurs invalides sont ignorées. */
export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  const get = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const from = get("du");
  const to = get("au");
  const actorId = get("auteur");
  const table = get("objet");
  const action = get("action");
  return {
    from: from && ISO_DATE.test(from) ? from : undefined,
    to: to && ISO_DATE.test(to) ? to : undefined,
    actorId: actorId && UUID.test(actorId) ? actorId : undefined,
    table: table && table in TABLE_LABELS ? table : undefined,
    action: action && (ACTION_FILTERS as readonly string[]).includes(action) ? action : undefined,
  };
}

const COLUMNS = "id, actor_id, actor_name, actor_email, action, table_name, record_id, before, after, details, created_at";

async function auditQuery(filters: AuditFilters) {
  const organization = await requireRole(AUDIT_READER_ROLES);
  const supabase = await createClient();
  let query = supabase
    .from("audit_entries")
    .select(COLUMNS)
    .eq("organization_id", organization.organizationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  // Bornes de dates en heure du Maroc, fin incluse
  if (filters.from) {
    query = query.gte("created_at", dayStartInstant(filters.from));
  }
  if (filters.to) {
    query = query.lt("created_at", dayStartInstant(addDays(filters.to, 1)));
  }
  if (filters.actorId) {
    query = query.eq("actor_id", filters.actorId);
  }
  if (filters.table) {
    query = query.eq("table_name", filters.table);
  }
  if (filters.action) {
    query = query.eq("action", filters.action);
  }
  // Dans un objet : un constructeur de requête attendu (await) serait exécuté
  return { query };
}

type RawEntry = { table_name: string | null; record_id: string | null; before: unknown; after: unknown; details: unknown };

/**
 * Actions métier sur un paiement (rejet, report…) : l'entrée ne porte pas l'état du
 * paiement ; son type et son numéro sont ajoutés au détail pour le désigner.
 */
async function withPaymentIdentity<T extends RawEntry>(entries: T[]): Promise<T[]> {
  const ids = [
    ...new Set(
      entries.filter((e) => e.table_name === "payments" && !e.before && !e.after && e.record_id).map((e) => e.record_id!),
    ),
  ];
  if (ids.length === 0) {
    return entries;
  }
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("id, type, number, reference").in("id", ids);
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return entries.map((entry) => {
    const payment = entry.record_id ? byId.get(entry.record_id) : undefined;
    if (!payment || entry.table_name !== "payments" || entry.before || entry.after) {
      return entry;
    }
    const details = entry.details && typeof entry.details === "object" ? entry.details : {};
    return { ...entry, details: { ...details, type: payment.type, number: payment.number, reference: payment.reference } };
  });
}

/** Une page du journal, la plus récente d'abord. */
export async function listAuditEntries(filters: AuditFilters, page: number) {
  const offset = (page - 1) * AUDIT_PAGE_SIZE;
  // Une ligne de plus pour savoir s'il existe une page suivante
  const { data, error } = await (await auditQuery(filters)).query.range(offset, offset + AUDIT_PAGE_SIZE);
  if (error) {
    throw new Error("Impossible de charger le journal d'audit.", { cause: error });
  }
  return { entries: await withPaymentIdentity(data.slice(0, AUDIT_PAGE_SIZE)), hasNext: data.length > AUDIT_PAGE_SIZE };
}

/** Entrées à exporter, plafonnées. */
export async function exportAuditEntries(filters: AuditFilters) {
  const { data, error } = await (await auditQuery(filters)).query.limit(AUDIT_EXPORT_LIMIT);
  if (error) {
    throw new Error("Impossible d'exporter le journal d'audit.", { cause: error });
  }
  return { entries: await withPaymentIdentity(data), truncated: data.length === AUDIT_EXPORT_LIMIT };
}

/** Membres de l'organisation, pour le filtre « Auteur ». */
export async function listAuditActors() {
  const organization = await requireRole(AUDIT_READER_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, profiles ( full_name, email )")
    .eq("organization_id", organization.organizationId);
  if (error) {
    throw new Error("Impossible de charger les membres.", { cause: error });
  }
  return data
    .map((m) => ({ value: m.user_id, label: m.profiles?.full_name || m.profiles?.email || "Membre" }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

export type AuditEntry = Awaited<ReturnType<typeof listAuditEntries>>["entries"][number];
