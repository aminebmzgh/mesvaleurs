"use server";

import { planError } from "@/lib/billing/guard";
import { revalidatePath } from "next/cache";
import { fromCents } from "@/lib/amount";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { type GuaranteeRequest, guaranteeRequestSchema } from "@/lib/payments/schemas";
import { createClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Émission d'un chèque de garantie : numéro attribué dans le chéquier, aucune facture réglée. */
export async function issueGuarantee(request: GuaranteeRequest): Promise<Result<{ batchId: string; pendingApproval: boolean }>> {
  const organization = await requireRole(WRITER_ROLES);
  const blocked = planError(organization, "guarantees");
  if (blocked) {
    return { ok: false, error: blocked };
  }
  const parsed = guaranteeRequestSchema.safeParse(request);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const input = parsed.data;
  const supabase = await createClient();
  const { data: batchId, error } = await supabase.rpc("issue_payments", {
    p_organization_id: organization.organizationId,
    p_checkbook_id: input.checkbookId,
    p_supplier_id: input.supplierId,
    p_payee_name: input.payeeName,
    p_issue_date: input.issueDate,
    p_issue_place: input.issuePlace,
    p_instruments: [{ amount: fromCents(input.amountCents), due_date: null }],
    p_allocations: [],
    p_guarantee: { purpose: input.purpose, return_due: input.returnDue },
  });
  if (error || !batchId) {
    const readable = error && ["P0001", "P0002", "22023", "42501"].includes(error.code);
    return { ok: false, error: readable ? error.message : "L'émission a échoué. Aucun numéro n'a été consommé." };
  }
  revalidatePath("/", "layout");
  // Double signature : lot au-delà du seuil ou d'un plafond, à valider avant impression
  const { data: batch } = await supabase.from("print_batches").select("approval_status").eq("id", batchId).single();
  return { ok: true, data: { batchId, pendingApproval: batch?.approval_status === "pending" } };
}
