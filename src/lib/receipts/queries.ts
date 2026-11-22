import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { getLetterhead } from "@/lib/letters/data";
import { paymentLabel } from "@/lib/payments/label";
import { createClient } from "@/lib/supabase/server";
import type { ReceiptPdfData } from "./pdf";

/** Accusé de réception fournisseur (spec §11 bis G) : valeurs remises, signataire, signature. */

const SIGNED_URL_SECONDS = 10 * 60;
const PAYMENT_COLUMNS =
  "id, type, status, number, reference, amount, issue_date, due_date, print_batch_id, checkbooks ( number_width ), bank_accounts ( label, banks ( name ) ), payment_receipt_items ( receipt_id )";

export type DeliverablePayment = { id: string; label: string; amount: number; issueDate: string; dueDate: string | null; bank: string };

/**
 * Valeurs à faire signer : chèques, LCN et chèques de garantie émis (ou remis sans
 * accusé) d'un lot, ou d'un paiement et des autres valeurs du même fournisseur en attente.
 */
export async function getDeliverablePayments({ batchId, paymentId }: { batchId?: string; paymentId?: string }) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;

  let supplierId: string | null = null;
  let preselected: string[] = [];
  if (paymentId) {
    const { data } = await supabase.from("payments").select("supplier_id").eq("organization_id", orgId).eq("id", paymentId).maybeSingle();
    supplierId = data?.supplier_id ?? null;
    preselected = [paymentId];
  } else if (batchId) {
    const { data } = await supabase.from("payments").select("id, supplier_id").eq("organization_id", orgId).eq("print_batch_id", batchId);
    supplierId = data?.[0]?.supplier_id ?? null;
    preselected = (data ?? []).map((row) => row.id);
  }
  if (!supplierId) {
    return null;
  }

  const [supplier, payments] = await Promise.all([
    supabase.from("suppliers").select("id, name, email, city").eq("organization_id", orgId).eq("id", supplierId).single(),
    supabase
      .from("payments")
      .select(PAYMENT_COLUMNS)
      .eq("organization_id", orgId)
      .eq("supplier_id", supplierId)
      .in("type", ["check", "lcn", "guarantee_check"])
      .in("status", ["issued", "delivered"])
      .order("issue_date")
      .order("number"),
  ]);
  if (supplier.error || payments.error) {
    throw new Error("Impossible de charger les valeurs à remettre.", { cause: supplier.error ?? payments.error });
  }
  const deliverable = payments.data
    .filter((payment) => !payment.payment_receipt_items)
    .map(
      (payment): DeliverablePayment => ({
        id: payment.id,
        label: paymentLabel(payment),
        amount: Number(payment.amount),
        issueDate: payment.issue_date,
        dueDate: payment.due_date,
        bank: payment.bank_accounts?.banks?.name ?? payment.bank_accounts?.label ?? "",
      }),
    );
  return {
    organizationId: orgId,
    supplier: supplier.data,
    payments: deliverable,
    selected: deliverable.filter((payment) => preselected.includes(payment.id)).map((payment) => payment.id),
  };
}

const RECEIPT_COLUMNS = `id, reference, signed_at, delivered_on, signer_name, signer_id_number, signature_path, photo_path, emailed_at, emailed_to, created_by,
  suppliers ( id, name, email, address, city, ice ),
  payment_receipt_items ( payments ( ${PAYMENT_COLUMNS} ) )`;

async function loadReceipt(id: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_receipts")
    .select(RECEIPT_COLUMNS)
    .eq("organization_id", organization.organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error("Impossible de charger l'accusé de réception.", { cause: error });
  }
  if (!data || !data.suppliers) {
    return null;
  }
  const payments = data.payment_receipt_items
    .flatMap((item) => (item.payments ? [item.payments] : []))
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    .map((payment) => ({
      id: payment.id,
      label: paymentLabel(payment),
      amount: Number(payment.amount),
      dueDate: payment.due_date,
      bank: payment.bank_accounts?.banks?.name ?? payment.bank_accounts?.label ?? "",
      number: payment.number,
    }));
  return { supabase, receipt: data, supplier: data.suppliers, payments, total: payments.reduce((sum, p) => sum + p.amount, 0) };
}

/** Accusé de réception, avec liens de courte durée vers la signature et la photo. */
export async function getReceipt(id: string) {
  const loaded = await loadReceipt(id);
  if (!loaded) {
    return null;
  }
  const { supabase, receipt } = loaded;
  const [signature, photo, creator] = await Promise.all([
    supabase.storage.from("cheques-scans").createSignedUrl(receipt.signature_path, SIGNED_URL_SECONDS),
    receipt.photo_path ? supabase.storage.from("cheques-scans").createSignedUrl(receipt.photo_path, SIGNED_URL_SECONDS) : null,
    receipt.created_by ? supabase.from("profiles").select("full_name, email").eq("id", receipt.created_by).maybeSingle() : null,
  ]);
  return {
    ...loaded,
    signatureUrl: signature.data?.signedUrl ?? null,
    photoUrl: photo?.data?.signedUrl ?? null,
    createdByName: creator?.data ? creator.data.full_name || creator.data.email : null,
  };
}

/** Données du reçu PDF : en-tête de l'entreprise, valeurs, signataire et image de la signature. */
export async function getReceiptPdfData(id: string): Promise<ReceiptPdfData | null> {
  const [loaded, letterhead] = await Promise.all([loadReceipt(id), getLetterhead()]);
  if (!loaded) {
    return null;
  }
  const { supabase, receipt, supplier, payments, total } = loaded;
  const { data: signature } = await supabase.storage.from("cheques-scans").download(receipt.signature_path);
  return {
    organization: letterhead.organization,
    supplier: { id: supplier.id, name: supplier.name, address: supplier.address, city: supplier.city, ice: supplier.ice },
    reference: receipt.reference,
    signedAt: receipt.signed_at,
    deliveredOn: receipt.delivered_on,
    signerName: receipt.signer_name,
    signerIdNumber: receipt.signer_id_number,
    signature: signature ? new Uint8Array(await signature.arrayBuffer()) : null,
    payments: payments.map(({ label, bank, dueDate, amount }) => ({ label, bank, dueDate, amount })),
    total,
  };
}

/** Accusés de réception de l'entreprise, du plus récent au plus ancien. */
export async function listReceipts(limit = 200) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_receipts")
    .select("id, reference, signed_at, signer_name, emailed_at, suppliers ( id, name ), payment_receipt_items ( payments ( amount ) )")
    .eq("organization_id", organization.organizationId)
    .order("signed_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error("Impossible de charger les accusés de réception.", { cause: error });
  }
  return data.map((receipt) => ({
    id: receipt.id,
    reference: receipt.reference,
    signedAt: receipt.signed_at,
    signerName: receipt.signer_name,
    emailedAt: receipt.emailed_at,
    supplier: receipt.suppliers,
    count: receipt.payment_receipt_items.length,
    total: receipt.payment_receipt_items.reduce((sum, item) => sum + Number(item.payments?.amount ?? 0), 0),
  }));
}
