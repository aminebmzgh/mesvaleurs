"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromCents, toCents } from "@/lib/amount";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { invoiceSchema } from "@/lib/invoices/schemas";
import { listOpenInvoices, type OpenInvoice } from "@/lib/payments/queries";
import { type IssueRequest, issueRequestSchema } from "@/lib/payments/schemas";
import { allocatePayments } from "@/lib/payments/split";
import { createClient } from "@/lib/supabase/server";
import { supplierSchema } from "@/lib/suppliers/schemas";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function loadOpenInvoices(supplierId: string): Promise<Result<OpenInvoice[]>> {
  await requireRole(WRITER_ROLES);
  const id = z.uuid().safeParse(supplierId);
  if (!id.success) {
    return { ok: false, error: "Fournisseur invalide." };
  }
  return { ok: true, data: await listOpenInvoices(id.data) };
}

/** Création d'un fournisseur à la volée, depuis l'assistant. */
export async function quickCreateSupplier(input: {
  name: string;
  payee_name: string;
  ice: string;
}): Promise<Result<{ id: string; name: string; payeeName: string; printCoverLetter: boolean }>> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = supplierSchema.safeParse({ ...input, print_cover_letter: "on", payment_terms_days: "" });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Fournisseur invalide." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...parsed.data, organization_id: organization.organizationId })
    .select("id, name, payee_name, print_cover_letter")
    .single();
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Un fournisseur avec cet ICE existe déjà." : "Impossible de créer le fournisseur.",
    };
  }
  revalidatePath("/fournisseurs");
  return {
    ok: true,
    data: { id: data.id, name: data.name, payeeName: data.payee_name || data.name, printCoverLetter: data.print_cover_letter },
  };
}

/** Saisie d'une facture à la volée, depuis l'assistant. */
export async function quickCreateInvoice(input: {
  supplier_id: string;
  number: string;
  issue_date: string;
  amount_incl_tax: string;
}): Promise<Result<OpenInvoice>> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Facture invalide." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .insert({ ...parsed.data, organization_id: organization.organizationId })
    .select("id, number, issue_date, legal_due_date, amount_incl_tax, amount_paid")
    .single();
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Ce fournisseur a déjà une facture avec ce numéro." : "Impossible d'enregistrer la facture.",
    };
  }
  revalidatePath("/factures");
  return {
    ok: true,
    data: {
      id: data.id,
      number: data.number,
      issueDate: data.issue_date,
      legalDueDate: data.legal_due_date,
      amountInclTax: data.amount_incl_tax,
      amountPaid: data.amount_paid,
    },
  };
}

/**
 * Émission du lot. Les affectations aux factures sont recalculées ici, à partir des
 * restes dus lus en base : le navigateur ne fournit que les montants et l'ordre.
 */
export async function issuePayments(request: IssueRequest): Promise<Result<{ batchId: string }>> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = issueRequestSchema.safeParse(request);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const input = parsed.data;
  const supabase = await createClient();

  let allocations: { index: number; invoice_id: string; amount: number }[] = [];
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
      input.instruments.map((instrument) => instrument.amountCents),
      input.invoiceIds.map((id) => ({
        invoiceId: id,
        dueCents: toCents(byId.get(id)!.amount_incl_tax) - toCents(byId.get(id)!.amount_paid),
      })),
    ).map((allocation) => ({
      index: allocation.paymentIndex,
      invoice_id: allocation.invoiceId,
      amount: fromCents(allocation.amountCents),
    }));
  }

  const { data: batchId, error } = await supabase.rpc("issue_payments", {
    p_organization_id: organization.organizationId,
    p_checkbook_id: input.checkbookId,
    p_supplier_id: input.supplierId,
    p_payee_name: input.payeeName,
    p_issue_date: input.issueDate,
    p_issue_place: input.issuePlace,
    p_instruments: input.instruments.map((instrument) => ({
      amount: fromCents(instrument.amountCents),
      due_date: instrument.dueDate,
    })),
    p_allocations: allocations,
  });
  if (error || !batchId) {
    // Les messages de la fonction SQL sont rédigés pour l'utilisateur
    const readable = error && ["P0001", "P0002", "22023", "42501"].includes(error.code);
    return { ok: false, error: readable ? error.message : "L'émission a échoué. Aucun numéro n'a été consommé." };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { batchId } };
}
