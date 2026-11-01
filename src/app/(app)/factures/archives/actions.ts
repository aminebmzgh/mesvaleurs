"use server";

import { z } from "zod";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { type ArchiveCheck, checkArchives } from "@/lib/invoices/archives";

/** Recalcule l'empreinte des pièces affichées et la compare à celle scellée à l'archivage. */
export async function verifyArchives(ids: string[]): Promise<{ results?: ArchiveCheck[]; error?: string }> {
  const organization = await requireActiveOrganization();
  const parsed = z.array(z.uuid()).max(200).safeParse(ids);
  if (!parsed.success) {
    return { error: "Sélection invalide." };
  }
  try {
    return { results: await checkArchives(organization.organizationId, parsed.data) };
  } catch {
    return { error: "Vérification impossible pour le moment. Réessayez." };
  }
}
