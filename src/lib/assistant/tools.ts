import "server-only";
import { z } from "zod";
import type { AiTool } from "@/lib/ai/openrouter";
import { loadLegalParams } from "@/lib/compliance/data";
import { lateFine, monthsLate } from "@/lib/compliance/late-payments";
import { addDays, daysBetween } from "@/lib/dates";
import { getForecast } from "@/lib/forecast/queries";
import { INVOICE_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/labels";
import { paymentLabel } from "@/lib/payments/label";
import { sanitizeSearch } from "@/lib/suppliers/schemas";
import type { createClient } from "@/lib/supabase/server";

/**
 * Outils de l'assistant IA : lectures seules des données de l'entreprise active
 * (filtre explicite par organisation, RLS en plus). Aucune coordonnée personnelle
 * (contact, e-mail, téléphone, RIB) n'est renvoyée au modèle. Chaque résultat porte
 * le lien de l'écran concerné, que l'assistant cite dans sa réponse.
 */
export type ToolContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  today: string;
};

const MAX_ROWS = 30;
const round2 = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => round2(values.reduce((total, value) => total + value, 0));

const supplierId = z.uuid().optional().catch(undefined);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
const limit = z.number().int().min(1).max(MAX_ROWS).catch(15).default(15);

const schemas = {
  rechercher_fournisseurs: z.object({ recherche: z.string().max(100).catch("").default("") }),
  lister_factures: z.object({
    fournisseur_id: supplierId,
    statut: z.enum(["a_payer", "payees", "contestees", "toutes"]).catch("a_payer").default("a_payer"),
    numero: z.string().max(60).optional().catch(undefined),
    echeance_avant: isoDate,
    limite: limit,
  }),
  lister_paiements: z.object({
    fournisseur_id: supplierId,
    statut: z.enum(["en_circulation", "debites", "rejetes", "en_opposition", "tous"]).catch("en_circulation").default("en_circulation"),
    type: z.enum(["cheque", "lcn", "virement", "garantie"]).optional().catch(undefined),
    du: isoDate,
    au: isoDate,
    numero: z.number().int().positive().optional().catch(undefined),
    limite: limit,
  }),
  delais_de_paiement: z.object({ horizon_jours: z.number().int().min(0).max(90).catch(30).default(30) }),
  tresorerie: z.object({ jours: z.number().int().min(1).max(90).catch(30).default(30) }),
};

type ToolName = keyof typeof schemas;

const supplierIdParam = { type: "string", description: "Identifiant du fournisseur (champ id renvoyé par rechercher_fournisseurs)." };
const dateParam = (description: string) => ({ type: "string", description: `${description} (AAAA-MM-JJ).` });
const limitParam = { type: "integer", description: `Nombre maximal de lignes (1 à ${MAX_ROWS}, 15 par défaut).` };

export const ASSISTANT_TOOLS: AiTool[] = [
  {
    type: "function",
    function: {
      name: "rechercher_fournisseurs",
      description:
        "Recherche des fournisseurs par nom ou ICE (vide : tous, par solde dû décroissant). Renvoie l'identifiant, le solde dû (factures non réglées), le montant en circulation (chèques et LCN émis non débités) et le nombre de factures ouvertes.",
      parameters: { type: "object", properties: { recherche: { type: "string", description: "Nom, partie du nom ou ICE." } } },
    },
  },
  {
    type: "function",
    function: {
      name: "lister_factures",
      description:
        "Factures fournisseurs, avec le reste à payer et la date limite légale de paiement (loi 69-21). Totaux sur toutes les factures correspondantes.",
      parameters: {
        type: "object",
        properties: {
          fournisseur_id: supplierIdParam,
          statut: { type: "string", enum: ["a_payer", "payees", "contestees", "toutes"], description: "a_payer par défaut (non payées ou partiellement)." },
          numero: { type: "string", description: "Numéro de facture, ou partie du numéro." },
          echeance_avant: dateParam("Date limite légale au plus tard le"),
          limite: limitParam,
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lister_paiements",
      description:
        "Chèques, LCN, virements et chèques de garantie émis. en_circulation = émis ou remis mais pas encore débités (« pas encore passés »). Totaux sur tous les paiements correspondants.",
      parameters: {
        type: "object",
        properties: {
          fournisseur_id: supplierIdParam,
          statut: { type: "string", enum: ["en_circulation", "debites", "rejetes", "en_opposition", "tous"], description: "en_circulation par défaut." },
          type: { type: "string", enum: ["cheque", "lcn", "virement", "garantie"] },
          du: dateParam("Émis à partir du"),
          au: dateParam("Émis jusqu'au"),
          numero: { type: "integer", description: "Numéro du chèque ou de la LCN." },
          limite: limitParam,
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delais_de_paiement",
      description:
        "Loi 69-21 : factures non soldées déjà en retard ou dont la date limite légale tombe dans l'horizon donné, avec l'amende indicative si elles étaient payées aujourd'hui. Pour « quelles factures risquent une amende ».",
      parameters: { type: "object", properties: { horizon_jours: { type: "integer", description: "Jours à venir inclus (30 par défaut)." } } },
    },
  },
  {
    type: "function",
    function: {
      name: "tresorerie",
      description:
        "Soldes des comptes bancaires et prévision de trésorerie : paiements en circulation et factures à payer à leur date limite. Solde le plus bas, premier jour négatif, sorties prévues sur la période.",
      parameters: { type: "object", properties: { jours: { type: "integer", description: "Période étudiée en jours (30 par défaut, 90 au plus)." } } },
    },
  },
];

const PAYMENT_STATUS_FILTERS: Record<string, string[] | null> = {
  en_circulation: ["issued", "delivered"],
  debites: ["paid"],
  rejetes: ["rejected"],
  en_opposition: ["stopped", "lost"],
  tous: null,
};
const PAYMENT_TYPES = { cheque: "check", lcn: "lcn", virement: "transfer", garantie: "guarantee_check" } as const;

async function searchSuppliers(context: ToolContext, { recherche }: z.infer<(typeof schemas)["rechercher_fournisseurs"]>) {
  const term = sanitizeSearch(recherche);
  let query = context.supabase
    .from("suppliers")
    .select("id, name, ice, city, payment_terms_days, is_active")
    .eq("organization_id", context.organizationId)
    .order("name")
    .limit(200);
  if (term) {
    query = query.or(`name.ilike.%${term}%,payee_name.ilike.%${term}%,ice.ilike.%${term}%`);
  }
  const [suppliers, summaries] = await Promise.all([
    query,
    context.supabase.from("supplier_summaries").select("id, amount_due, amount_in_circulation, open_invoice_count").eq("organization_id", context.organizationId),
  ]);
  const byId = new Map((summaries.data ?? []).map((row) => [row.id, row]));
  const rows = (suppliers.data ?? [])
    .map((supplier) => {
      const summary = byId.get(supplier.id);
      return {
        id: supplier.id,
        nom: supplier.name,
        ice: supplier.ice,
        ville: supplier.city,
        archive: !supplier.is_active,
        delai_convenu_jours: supplier.payment_terms_days,
        solde_du: Number(summary?.amount_due ?? 0),
        en_circulation: Number(summary?.amount_in_circulation ?? 0),
        factures_ouvertes: summary?.open_invoice_count ?? 0,
        lien: `/fournisseurs/${supplier.id}`,
      };
    })
    .sort((a, b) => b.solde_du - a.solde_du || a.nom.localeCompare(b.nom, "fr"));
  return { nombre: rows.length, fournisseurs: rows.slice(0, MAX_ROWS) };
}

async function listInvoices(context: ToolContext, args: z.infer<(typeof schemas)["lister_factures"]>) {
  let query = context.supabase
    .from("invoices")
    .select("id, number, issue_date, legal_due_date, amount_incl_tax, amount_paid, status, suppliers ( name )")
    .eq("organization_id", context.organizationId)
    .order("legal_due_date", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (args.statut === "a_payer") {
    query = query.in("status", ["unpaid", "partially_paid"]);
  } else if (args.statut === "payees") {
    query = query.eq("status", "paid");
  } else if (args.statut === "contestees") {
    query = query.eq("status", "disputed");
  }
  if (args.fournisseur_id) {
    query = query.eq("supplier_id", args.fournisseur_id);
  }
  const number = sanitizeSearch(args.numero);
  if (number) {
    query = query.ilike("number", `%${number}%`);
  }
  if (args.echeance_avant) {
    query = query.lte("legal_due_date", args.echeance_avant);
  }
  const { data } = await query;
  const rows = (data ?? []).map((invoice) => ({
    numero: invoice.number,
    fournisseur: invoice.suppliers?.name ?? "",
    date: invoice.issue_date,
    date_limite_legale: invoice.legal_due_date,
    jours_avant_date_limite: invoice.legal_due_date ? daysBetween(context.today, invoice.legal_due_date) : null,
    montant_ttc: Number(invoice.amount_incl_tax),
    reste_a_payer: round2(Number(invoice.amount_incl_tax) - Number(invoice.amount_paid)),
    statut: INVOICE_STATUS_LABELS[invoice.status],
    lien: `/factures/${invoice.id}`,
  }));
  return {
    nombre: rows.length,
    total_ttc: sum(rows.map((row) => row.montant_ttc)),
    total_reste_a_payer: sum(rows.map((row) => row.reste_a_payer)),
    factures: rows.slice(0, args.limite),
  };
}

async function listPayments(context: ToolContext, args: z.infer<(typeof schemas)["lister_paiements"]>) {
  let query = context.supabase
    .from("payments")
    .select("id, type, status, number, reference, amount, issue_date, due_date, debited_at, print_batch_id, suppliers ( name ), checkbooks ( number_width ), bank_accounts ( label )")
    .eq("organization_id", context.organizationId)
    .neq("status", "draft")
    .order("issue_date", { ascending: false })
    .limit(1000);
  const statuses = PAYMENT_STATUS_FILTERS[args.statut];
  if (statuses) {
    query = query.in("status", statuses as ("issued" | "delivered" | "paid" | "rejected" | "stopped" | "lost")[]);
  }
  if (args.type) {
    query = query.eq("type", PAYMENT_TYPES[args.type]);
  }
  if (args.fournisseur_id) {
    query = query.eq("supplier_id", args.fournisseur_id);
  }
  if (args.du) {
    query = query.gte("issue_date", args.du);
  }
  if (args.au) {
    query = query.lte("issue_date", args.au);
  }
  if (args.numero) {
    query = query.eq("number", args.numero);
  }
  const { data } = await query;
  const rows = (data ?? []).map((payment) => ({
    paiement: paymentLabel(payment),
    type: PAYMENT_TYPE_LABELS[payment.type],
    statut: PAYMENT_STATUS_LABELS[payment.status],
    fournisseur: payment.suppliers?.name ?? "",
    compte: payment.bank_accounts?.label ?? "",
    montant: Number(payment.amount),
    emis_le: payment.issue_date,
    echeance: payment.due_date,
    debite_le: payment.debited_at,
    lien: payment.number != null ? `/paiements?numero=${payment.number}&statut=all` : payment.print_batch_id ? `/paiements/lots/${payment.print_batch_id}` : "/paiements?statut=all",
  }));
  return { nombre: rows.length, total: sum(rows.map((row) => row.montant)), paiements: rows.slice(0, args.limite) };
}

async function paymentDelays(context: ToolContext, { horizon_jours }: z.infer<(typeof schemas)["delais_de_paiement"]>) {
  const [params, invoices] = await Promise.all([
    loadLegalParams(context.supabase),
    context.supabase
      .from("invoices")
      .select("id, number, legal_due_date, amount_incl_tax, amount_paid, suppliers ( name )")
      .eq("organization_id", context.organizationId)
      .in("status", ["unpaid", "partially_paid"])
      .lte("legal_due_date", addDays(context.today, horizon_jours))
      .order("legal_due_date")
      .limit(1000),
  ]);
  const rows = (invoices.data ?? []).flatMap((invoice) => {
    const remaining = round2(Number(invoice.amount_incl_tax) - Number(invoice.amount_paid));
    if (!invoice.legal_due_date || remaining <= 0) {
      return [];
    }
    const late = invoice.legal_due_date < context.today;
    const months = late ? monthsLate(invoice.legal_due_date, context.today) : 0;
    return [
      {
        numero: invoice.number,
        fournisseur: invoice.suppliers?.name ?? "",
        date_limite_legale: invoice.legal_due_date,
        en_retard: late,
        jours: daysBetween(context.today, invoice.legal_due_date),
        reste_a_payer: remaining,
        amende_indicative_si_payee_aujourdhui: late ? lateFine(remaining, months, Number(invoice.amount_incl_tax), params) : 0,
        lien: `/factures/${invoice.id}`,
      },
    ];
  });
  const late = rows.filter((row) => row.en_retard);
  return {
    en_retard: { nombre: late.length, montant: sum(late.map((row) => row.reste_a_payer)), amendes_indicatives: sum(late.map((row) => row.amende_indicative_si_payee_aujourdhui)) },
    a_echeance_sous_horizon: { nombre: rows.length - late.length, montant: sum(rows.filter((row) => !row.en_retard).map((row) => row.reste_a_payer)) },
    factures: rows.slice(0, MAX_ROWS),
    page: "/conformite",
    avertissement: "Amendes indicatives (loi 69-21), à valider par un expert-comptable.",
  };
}

async function treasury(context: ToolContext, { jours }: z.infer<(typeof schemas)["tresorerie"]>) {
  const [{ forecast }, accounts] = await Promise.all([
    getForecast({ includeInvoices: true }),
    context.supabase.from("bank_accounts").select("label, current_balance").eq("organization_id", context.organizationId).eq("is_active", true).order("label"),
  ]);
  const until = addDays(context.today, jours);
  const days = forecast.days.filter((day) => day.date <= until);
  const low = days.reduce((min, day) => (day.balance < min.balance ? day : min), days[0] ?? { date: context.today, balance: forecast.openingBalance });
  const negative = days.find((day) => day.balance < 0);
  const movements = days.flatMap((day) => day.movements);
  return {
    comptes: (accounts.data ?? []).map((account) => ({ compte: account.label, solde_actuel: Number(account.current_balance) })),
    solde_total_actuel: forecast.openingBalance,
    periode: { du: context.today, au: until },
    sorties_prevues: sum(days.map((day) => day.outflow)),
    solde_fin_periode: days.at(-1)?.balance ?? forecast.openingBalance,
    solde_le_plus_bas: { date: low.date, solde: low.balance },
    premier_jour_negatif: negative ? { date: negative.date, solde: negative.balance } : null,
    principales_sorties: movements
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((movement) => ({ date: movement.date, libelle: movement.label, fournisseur: movement.supplier, montant: movement.amount, lien: movement.href })),
    page: "/tresorerie",
  };
}

const EXECUTORS: { [name in ToolName]: (context: ToolContext, args: z.infer<(typeof schemas)[name]>) => Promise<unknown> } = {
  rechercher_fournisseurs: searchSuppliers,
  lister_factures: listInvoices,
  lister_paiements: listPayments,
  delais_de_paiement: paymentDelays,
  tresorerie: treasury,
};

/** Exécute un outil demandé par le modèle ; arguments invalides ramenés aux valeurs par défaut. */
export async function runAssistantTool(context: ToolContext, name: string, rawArguments: string): Promise<unknown> {
  if (!(name in schemas)) {
    return { erreur: `Outil inconnu : ${name}.` };
  }
  let json: unknown = {};
  try {
    json = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    json = {};
  }
  const toolName = name as ToolName;
  const args = schemas[toolName].parse(json && typeof json === "object" ? json : {});
  return (EXECUTORS[toolName] as (context: ToolContext, args: unknown) => Promise<unknown>)(context, args);
}
