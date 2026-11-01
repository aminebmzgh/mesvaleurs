"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type InboxResult = { error?: string };

/** Nouvelle adresse de réception des relevés (l'ancienne cesse de fonctionner). */
export async function renewInbox(): Promise<InboxResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("renew_statement_inbox", { p_organization_id: organization.organizationId });
  revalidatePath("/rapprochement");
  return error ? { error: "Impossible de créer l'adresse de réception." } : {};
}

/** Relevé reçu ignoré (pas un relevé, doublon…) ou remis en attente. */
export async function setInboundIgnored(id: string, ignored: boolean): Promise<InboxResult> {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_inbound_statement_status", { p_id: z.uuid().parse(id), p_status: ignored ? "ignored" : "pending" });
  revalidatePath("/rapprochement");
  return error ? { error: "Impossible de modifier ce relevé." } : {};
}

/** Relevé reçu importé depuis l'écran d'import : rattaché à son import, il quitte la boîte. */
export async function markInboundImported(id: string, importId: string): Promise<InboxResult> {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_inbound_statement_status", {
    p_id: z.uuid().parse(id),
    p_status: "imported",
    p_import_id: z.uuid().parse(importId),
  });
  revalidatePath("/rapprochement");
  return error ? { error: "Relevé importé, mais il reste affiché dans la boîte." } : {};
}
