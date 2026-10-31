import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Archivage légal (spec §11 bis A) : l'empreinte SHA-256 de chaque pièce archivée est
 * calculée ici, côté serveur, à partir du fichier stocké, puis scellée une seule fois
 * (clé de service). Une vérification ultérieure recalcule l'empreinte et la compare.
 */

type Archive = { id: string; file_path: string; sha256: string | null };

export type ArchiveCheck = { id: string; status: "intact" | "sealed" | "altered" | "missing" };

async function digest(path: string): Promise<{ sha256: string; size: number } | null> {
  const { data, error } = await createAdminClient().storage.from("factures").download(path);
  if (error || !data) {
    return null;
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  return { sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length };
}

/** Vérifie (et scelle, si ce n'est pas encore fait) les archives données, de l'organisation donnée. */
export async function checkArchives(organizationId: string, ids: string[]): Promise<ArchiveCheck[]> {
  if (ids.length === 0) {
    return [];
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invoice_archives")
    .select("id, file_path, sha256")
    .eq("organization_id", organizationId)
    .in("id", ids);
  if (error) {
    throw new Error("Impossible de lire le registre des archives.", { cause: error });
  }
  return Promise.all(
    (data as Archive[]).map(async (archive) => {
      const file = await digest(archive.file_path);
      if (!file) {
        return { id: archive.id, status: "missing" as const };
      }
      if (archive.sha256 === null) {
        const { error: sealError } = await admin.rpc("seal_invoice_archive", { p_id: archive.id, p_sha256: file.sha256, p_size: file.size });
        if (sealError) {
          throw new Error("Impossible de sceller l'archive.", { cause: sealError });
        }
        return { id: archive.id, status: "sealed" as const };
      }
      return { id: archive.id, status: archive.sha256 === file.sha256 ? ("intact" as const) : ("altered" as const) };
    }),
  );
}

/** Scelle les pièces d'une facture qui ne le sont pas encore (après un dépôt). */
export async function sealInvoiceArchives(organizationId: string, invoiceId: string): Promise<void> {
  const { data } = await createAdminClient()
    .from("invoice_archives")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)
    .is("sha256", null);
  await checkArchives(
    organizationId,
    (data ?? []).map((archive) => archive.id),
  );
}
