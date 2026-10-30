"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { APPROVER_ROLES } from "@/lib/payments/approvals";
import { createClient } from "@/lib/supabase/server";

export type ApprovalResult = { error?: string };

function readable(error: { code?: string; message?: string } | null, fallback: string): ApprovalResult {
  if (!error) {
    return {};
  }
  return { error: ["P0001", "P0002", "22023"].includes(error.code ?? "") && error.message ? error.message : fallback };
}

/** Validation d'un lot (double signature) : ses paiements sont émis, il peut être imprimé. */
export async function approveBatch(batchId: string): Promise<ApprovalResult> {
  await requireRole(APPROVER_ROLES);
  const id = z.uuid().safeParse(batchId);
  if (!id.success) {
    return { error: "Lot introuvable." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_batch", { p_batch_id: id.data });
  revalidatePath("/", "layout");
  return readable(error, "Impossible de valider le lot.");
}

/** Refus d'un lot : ses paiements sont annulés avec le motif, les numéros restent dans l'historique. */
export async function refuseBatch(batchId: string, reason: string): Promise<ApprovalResult> {
  await requireRole(APPROVER_ROLES);
  const input = z.object({ id: z.uuid(), reason: z.string().trim().min(3).max(300) }).safeParse({ id: batchId, reason });
  if (!input.success) {
    return { error: "Indiquez le motif du refus (3 à 300 caractères)." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("refuse_batch", { p_batch_id: input.data.id, p_reason: input.data.reason });
  revalidatePath("/", "layout");
  return readable(error, "Impossible de refuser le lot.");
}
