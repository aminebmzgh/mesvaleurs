import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { formatRib } from "@/lib/rib";
import { createClient } from "@/lib/supabase/server";
import { defaultTemplateFor } from "./default-templates";
import type { EnvelopeAddress } from "./envelope";
import { parseTemplateOptions, parseZones, type PrintTemplate } from "./fields";
import type { PrintData } from "./layout";
import type { Background } from "./pdf";

export type StoredTemplate = PrintTemplate & {
  id: string;
  bankId: string | null;
  backgroundPath: string | null;
  sourceKey: string | null;
};

type TemplateRow = {
  id: string;
  name: string;
  type: "check" | "lcn";
  bank_id: string | null;
  width_mm: number;
  height_mm: number;
  offset_x_mm: number;
  offset_y_mm: number;
  zones: unknown;
  options: unknown;
  background_path: string | null;
  source_key: string | null;
};

const TEMPLATE_COLUMNS =
  "id, name, type, bank_id, width_mm, height_mm, offset_x_mm, offset_y_mm, zones, options, background_path, source_key";

export function toTemplate(row: TemplateRow): StoredTemplate {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    bankId: row.bank_id,
    widthMm: row.width_mm,
    heightMm: row.height_mm,
    offsetXMm: row.offset_x_mm,
    offsetYMm: row.offset_y_mm,
    zones: parseZones(row.zones),
    options: parseTemplateOptions(row.options),
    backgroundPath: row.background_path,
    sourceKey: row.source_key,
  };
}

/** Modèles d'impression de l'organisation active. */
export async function listTemplates() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("print_templates")
    .select(`${TEMPLATE_COLUMNS}, banks ( name )`)
    .eq("organization_id", organization.organizationId)
    .order("type")
    .order("name");
  if (error) {
    throw new Error("Impossible de charger les modèles d'impression.", { cause: error });
  }
  return data.map((row) => ({ ...toTemplate(row), bankName: row.banks?.name ?? null }));
}

export async function getTemplate(id: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("print_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("organization_id", organization.organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error("Impossible de charger le modèle d'impression.", { cause: error });
  }
  return data ? toTemplate(data) : null;
}

/** Image de fond d'un modèle (scan de la formule), pour l'impression test. */
export async function loadBackground(path: string | null): Promise<Background | undefined> {
  if (!path) {
    return undefined;
  }
  const supabase = await createClient();
  const { data } = await supabase.storage.from("modeles-impression").download(path);
  if (!data || !["image/jpeg", "image/png"].includes(data.type)) {
    return undefined;
  }
  return { bytes: new Uint8Array(await data.arrayBuffer()), mimeType: data.type };
}

/** Lot à imprimer : modèle du carnet (ou modèle par défaut de la banque) et formules. */
export async function getBatchPrintJob(batchId: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;

  const [{ data: payments, error }, { data: org }] = await Promise.all([
    supabase
      .from("payments")
      .select(
        `id, type, status, amount, payee_name, issue_date, issue_place, due_date,
         suppliers ( name, address, city ),
         bank_accounts ( rib, branch, banks ( short_name ) ),
         checkbooks ( print_template_id ),
         payment_allocations ( invoices ( number ) )`,
      )
      .eq("organization_id", orgId)
      .eq("print_batch_id", batchId)
      .order("number"),
    supabase.from("organizations").select("name, address, city").eq("id", orgId).single(),
  ]);
  if (error) {
    throw new Error("Impossible de charger le lot à imprimer.", { cause: error });
  }
  // Les formules annulées ne sont pas réimprimées
  const printable = (payments ?? []).filter((payment) => payment.status !== "cancelled");
  if (printable.length === 0) {
    return null;
  }

  const first = printable[0];
  const type = first.type === "lcn" ? "lcn" : "check";
  const templateId = first.checkbooks?.print_template_id;
  const stored = templateId ? await getTemplate(templateId) : null;
  const template: PrintTemplate & { backgroundPath?: string | null } =
    stored ?? defaultTemplateFor(type, first.bank_accounts?.banks?.short_name);

  const orgAddress = [org?.address, org?.city].filter(Boolean).join(", ");
  const items: PrintData[] = printable.map((payment) => {
    const invoiceNumbers = payment.payment_allocations.flatMap((a) => (a.invoices ? [a.invoices.number] : []));
    return {
      type,
      amount: payment.amount,
      payee: payment.payee_name,
      place: payment.issue_place ?? "",
      issueDate: payment.issue_date,
      dueDate: payment.due_date,
      drawerName: payment.payee_name,
      drawerAddress: [payment.suppliers?.address, payment.suppliers?.city].filter(Boolean).join(", "),
      draweeName: org?.name ?? "",
      draweeAddress: orgAddress,
      rib: payment.bank_accounts?.rib ? formatRib(payment.bank_accounts.rib) : "",
      bankBranch: payment.bank_accounts?.branch ?? "",
      bankCity: org?.city ?? "",
      cause: invoiceNumbers.length > 0 ? `Facture${invoiceNumbers.length > 1 ? "s" : ""} ${invoiceNumbers.join(", ")}` : "",
      rectified: organization.amountWordsRectified,
    };
  });

  return { template, backgroundPath: stored?.backgroundPath ?? null, items };
}

/** Données d'exemple pour l'impression test d'un modèle. */
export function sampleData(type: "check" | "lcn", rectified: boolean, org: { name: string; city: string }): PrintData {
  return {
    type,
    amount: 1234567.89,
    payee: "SOTRAMA MATERIAUX SARL",
    place: org.city || "Casablanca",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: type === "lcn" ? new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) : null,
    drawerName: "SOTRAMA MATERIAUX SARL",
    drawerAddress: "Boulevard Zerktouni, Casablanca",
    draweeName: org.name,
    draweeAddress: org.city,
    rib: "007 780 0001234567890123 96",
    bankBranch: "Agence centrale",
    bankCity: org.city,
    cause: "Factures F-2026-0412, F-2026-0498",
    rectified,
  };
}

/** Expéditeur (l'entreprise) et destinataire (un fournisseur) d'une enveloppe ; null si le fournisseur n'existe pas. */
export async function getEnvelopeAddresses(supplierId: string): Promise<{ sender: EnvelopeAddress; recipient: EnvelopeAddress } | null> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const [org, supplier] = await Promise.all([
    supabase.from("organizations").select("name, address, city").eq("id", orgId).single(),
    supabase.from("suppliers").select("name, contact_name, address, city").eq("organization_id", orgId).eq("id", supplierId).maybeSingle(),
  ]);
  if (org.error || supplier.error) {
    throw new Error("Impossible de préparer l'enveloppe.", { cause: org.error ?? supplier.error });
  }
  if (!supplier.data) {
    return null;
  }
  return {
    sender: { name: org.data.name, lines: [org.data.address ?? "", org.data.city ?? ""] },
    recipient: {
      name: supplier.data.name,
      attention: supplier.data.contact_name,
      lines: [supplier.data.address ?? "", supplier.data.city ?? ""],
    },
  };
}

/** Fournisseur d'un lot (pour son enveloppe). */
export async function getBatchSupplierId(batchId: string): Promise<string | null> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("supplier_id")
    .eq("organization_id", organization.organizationId)
    .eq("print_batch_id", batchId)
    .limit(1)
    .maybeSingle();
  return data?.supplier_id ?? null;
}
