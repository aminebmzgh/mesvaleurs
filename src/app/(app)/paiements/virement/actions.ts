"use server";

import { revalidatePath } from "next/cache";
import { fromCents, toCents } from "@/lib/amount";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { type TransferRequest, transferRequestSchema } from "@/lib/payments/schemas";
import { allocatePayments } from "@/lib/payments/split";
import { createClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Saisie d'un virement. Comme pour l'émission, les affectations aux factures sont
 * recalculées à partir des restes dus lus en base.
 */
export async function recordTransfer(request: TransferRequest): Promise<Result<{ paymentId: string }>> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = transferRequestSchema.safeParse(request);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const input = parsed.data;
  const supabase = await createClient();

  let allocations: { invoice_id: string; amount: number }[] = [];
  if (input.invoiceIds.length > 0) {
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id, amount_incl_tax, amount_paid")
      .eq("organization_id", organization.organizationId)
      .eq("supplier_id", input.supplierId)
      .in("id", input.invoiceIds);
    if (error || !invoices || invoices.length !== new Set(input.invoiceIds).size) {
      return { ok: false, error: "Une des factures sélectionnées est introuvable." };
    }
    const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    allocations = allocatePayments(
      [input.amountCents],
      input.invoiceIds.map((id) => ({
        invoiceId: id,
        dueCents: toCents(byId.get(id)!.amount_incl_tax) - toCents(byId.get(id)!.amount_paid),
      })),
    ).map((allocation) => ({ invoice_id: allocation.invoiceId, amount: fromCents(allocation.amountCents) }));
  }

  const { data: paymentId, error } = await supabase.rpc("record_transfer", {
    p_organization_id: organization.organizationId,
    p_bank_account_id: input.bankAccountId,
    p_supplier_id: input.supplierId,
    p_amount: fromCents(input.amountCents),
    p_transfer_date: input.transferDate,
    p_reference: input.reference,
    p_debited: input.debited,
    p_allocations: allocations,
    p_notes: input.notes,
  });
  if (error || !paymentId) {
    const readable = error && ["P0001", "P0002", "22023", "42501"].includes(error.code);
    return { ok: false, error: readable ? error.message : "Le virement n'a pas pu être enregistré." };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { paymentId } };
}
