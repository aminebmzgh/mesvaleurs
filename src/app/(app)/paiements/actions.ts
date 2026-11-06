"use server";

import { planError } from "@/lib/billing/guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

function readable(error: { code?: string; message?: string } | null): ActionResult {
  if (!error) {
    return {};
  }
  return { error: error.code === "P0001" && error.message ? error.message : "Impossible de modifier le paiement." };
}

/** Remise du chèque ou de la LCN au fournisseur (sert de date de paiement pour la loi 69-21). */
export async function markDelivered(paymentId: string, deliveredAt: string): Promise<ActionResult> {
  const organization = await requireRole(WRITER_ROLES);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(deliveredAt);
  if (!date.success) {
    return { error: "Date de remise invalide." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: "delivered", delivered_at: date.data })
    .eq("id", z.uuid().parse(paymentId))
    .eq("organization_id", organization.organizationId)
    .eq("status", "issued");
  revalidatePath("/", "layout");
  return readable(error);
}

/** Virement en attente ou chèque de garantie encaissé : débit constaté (sans passer par le rapprochement). */
export async function markDebited(paymentId: string, debitedAt: string): Promise<ActionResult> {
  const organization = await requireRole(WRITER_ROLES);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(debitedAt);
  if (!date.success) {
    return { error: "Date de débit invalide." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: "paid", debited_at: date.data })
    .eq("id", z.uuid().parse(paymentId))
    .eq("organization_id", organization.organizationId)
    .in("type", ["transfer", "guarantee_check"])
    .in("status", ["issued", "delivered"]);
  revalidatePath("/", "layout");
  return readable(error);
}

/**
 * Annulation (formule gâchée, erreur d'impression…) : le numéro reste dans
 * l'historique avec son motif ; la facture redevient à payer.
 */
export async function cancelPayment(paymentId: string, reason: string): Promise<ActionResult> {
  const organization = await requireRole(WRITER_ROLES);
  const motive = reason.trim();
  if (motive.length < 3 || motive.length > 300) {
    return { error: "Indiquez le motif de l'annulation (3 à 300 caractères)." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: "cancelled", cancellation_reason: motive })
    .eq("id", z.uuid().parse(paymentId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/", "layout");
  return readable(error);
}

const REJECTION_KINDS = ["insufficient_funds", "signature", "stop_order", "irregularity", "other"] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Messages des fonctions SQL rédigés pour l'utilisateur. */
function readableRpc(error: { code?: string; message?: string } | null, fallback: string): ActionResult {
  if (!error) {
    return {};
  }
  return { error: ["P0001", "P0002", "22023"].includes(error.code ?? "") && error.message ? error.message : fallback };
}

/** Rejet (impayé) d'un chèque ou d'une LCN : ouvre le délai de régularisation (loi 71-24). */
export async function rejectPayment(paymentId: string, kind: string, reason: string, rejectedOn: string): Promise<ActionResult> {
  await requireRole(WRITER_ROLES);
  const input = z
    .object({ id: z.uuid(), kind: z.enum(REJECTION_KINDS), reason: z.string().trim().max(300), date: isoDate })
    .safeParse({ id: paymentId, kind, reason, date: rejectedOn });
  if (!input.success) {
    return { error: "Motif ou date de rejet invalide." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_payment", {
    p_payment_id: input.data.id,
    p_kind: input.data.kind,
    p_reason: input.data.reason,
    p_rejected_on: input.data.date,
  });
  revalidatePath("/", "layout");
  return readableRpc(error, "Impossible d'enregistrer le rejet.");
}

/** Régularisation par nouvelle provision (chèque représenté) ou par un autre moyen noté. */
export async function regularizePayment(
  paymentId: string,
  method: "new_provision" | "other",
  regularizedOn: string,
  notes: string,
): Promise<ActionResult> {
  await requireRole(WRITER_ROLES);
  const input = z
    .object({ id: z.uuid(), method: z.enum(["new_provision", "other"]), date: isoDate, notes: z.string().trim().max(500) })
    .safeParse({ id: paymentId, method, date: regularizedOn, notes });
  if (!input.success) {
    return { error: "Mode ou date de régularisation invalide." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("regularize_payment", {
    p_payment_id: input.data.id,
    p_method: input.data.method,
    p_regularized_on: input.data.date,
    p_notes: input.data.notes,
  });
  revalidatePath("/", "layout");
  return readableRpc(error, "Impossible d'enregistrer la régularisation.");
}

/** Report de l'échéance d'une LCN, avec l'accord du fournisseur. */
export async function postponeLcn(paymentId: string, newDueDate: string, reason: string, agreedAt: string): Promise<ActionResult> {
  const organization = await requireRole(WRITER_ROLES);
  const blocked = planError(organization, "lcn_postpone");
  if (blocked) {
    return { error: blocked };
  }
  const input = z
    .object({ id: z.uuid(), due: isoDate, reason: z.string().trim().min(3).max(300), agreed: isoDate })
    .safeParse({ id: paymentId, due: newDueDate, reason, agreed: agreedAt });
  if (!input.success) {
    return { error: "Indiquez la nouvelle échéance, le motif et la date de l'accord du fournisseur." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("postpone_lcn", {
    p_payment_id: input.data.id,
    p_new_due_date: input.data.due,
    p_reason: input.data.reason,
    p_supplier_agreed_at: input.data.agreed,
  });
  revalidatePath("/", "layout");
  return readableRpc(error, "Impossible de reporter l'échéance.");
}

/** Chèque de garantie restitué par le fournisseur, ou détruit. */
export async function closeGuarantee(paymentId: string, outcome: "returned" | "destroyed", closedOn: string): Promise<ActionResult> {
  await requireRole(WRITER_ROLES);
  const input = z
    .object({ id: z.uuid(), outcome: z.enum(["returned", "destroyed"]), date: isoDate })
    .safeParse({ id: paymentId, outcome, date: closedOn });
  if (!input.success) {
    return { error: "Date invalide." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_guarantee", {
    p_payment_id: input.data.id,
    p_outcome: input.data.outcome,
    p_closed_on: input.data.date,
  });
  revalidatePath("/", "layout");
  return readableRpc(error, "Impossible de clôturer le chèque de garantie.");
}

export async function markGuaranteeReturned(paymentId: string, date: string) {
  return closeGuarantee(paymentId, "returned", date);
}

export async function markGuaranteeDestroyed(paymentId: string, date: string) {
  return closeGuarantee(paymentId, "destroyed", date);
}

const STOP_ORDER_REASONS = ["lost", "stolen", "fraudulent_use", "holder_insolvency"] as const;
const stopOrderInput = z.object({
  reason: z.enum(STOP_ORDER_REASONS),
  occurredOn: isoDate,
  policeReport: z.string().trim().max(120),
  notes: z.string().trim().max(500),
});

export type StopOrderInput = z.input<typeof stopOrderInput>;
export type StopOrderResult = ActionResult & { stopOrderId?: string };

/** Opposition sur un chèque ou une LCN en circulation (perte, vol…) : le paiement passe en opposition. */
export async function stopPayment(paymentId: string, details: StopOrderInput): Promise<StopOrderResult> {
  await requireRole(WRITER_ROLES);
  const id = z.uuid().safeParse(paymentId);
  const input = stopOrderInput.safeParse(details);
  if (!id.success || !input.success) {
    return { error: "Motif ou date du constat invalide." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stop_payment", {
    p_payment_id: id.data,
    p_reason: input.data.reason,
    p_occurred_on: input.data.occurredOn,
    p_police_report: input.data.policeReport,
    p_notes: input.data.notes,
  });
  revalidatePath("/", "layout");
  return error ? readableRpc(error, "Impossible d'enregistrer l'opposition.") : { stopOrderId: data };
}

/** Opposition sur des formules vierges d'un carnet (perte ou vol du chéquier, de formules). */
export async function stopBlankForms(
  checkbookId: string,
  firstNumber: number,
  lastNumber: number,
  details: StopOrderInput,
): Promise<StopOrderResult> {
  await requireRole(WRITER_ROLES);
  const range = z
    .object({ id: z.uuid(), first: z.int().nonnegative(), last: z.int().nonnegative() })
    .refine((r) => r.last >= r.first)
    .safeParse({ id: checkbookId, first: firstNumber, last: lastNumber });
  const input = stopOrderInput.safeParse(details);
  if (!range.success) {
    return { error: "Numéros de formules invalides." };
  }
  if (!input.success) {
    return { error: "Motif ou date du constat invalide." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stop_blank_forms", {
    p_checkbook_id: range.data.id,
    p_first_number: range.data.first,
    p_last_number: range.data.last,
    p_reason: input.data.reason,
    p_occurred_on: input.data.occurredOn,
    p_police_report: input.data.policeReport,
    p_notes: input.data.notes,
  });
  revalidatePath("/", "layout");
  return error ? readableRpc(error, "Impossible d'enregistrer l'opposition.") : { stopOrderId: data };
}
