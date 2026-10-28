"use server";

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

/** Virement en attente : débit constaté (sans passer par le rapprochement). */
export async function markTransferDebited(paymentId: string, debitedAt: string): Promise<ActionResult> {
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
    .eq("type", "transfer")
    .eq("status", "issued");
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
