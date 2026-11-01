"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { todayIso } from "@/lib/dates";
import { sendEmail } from "@/lib/email/send";
import { formatDate, formatMAD } from "@/lib/format";
import { getReceiptPdfData } from "@/lib/receipts/queries";
import { receiptPdf } from "@/lib/receipts/pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validation";

const receiptPath = (organizationId: string) => new RegExp(`^${organizationId}/accuses/[0-9a-f-]{36}\\.(png|jpg)$`);

const recordSchema = z.object({
  paymentIds: z.array(z.uuid()).min(1).max(100),
  signerName: z.string().trim().min(2, { error: "Indiquez le nom de la personne qui reçoit les valeurs." }).max(120),
  signerIdNumber: z.string().trim().max(20).optional(),
  signaturePath: z.string(),
  photoPath: z.string().nullable(),
});

/**
 * Remise signée : signature (et photo des valeurs) déjà déposées par le navigateur dans le
 * stockage ; la base vérifie les valeurs, numérote l'accusé et passe les paiements en remis.
 */
export async function recordReceipt(input: z.input<typeof recordSchema>): Promise<{ receiptId?: string; error?: string }> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = recordSchema.safeParse(input);
  const pattern = receiptPath(organization.organizationId);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }
  const { paymentIds, signerName, signerIdNumber, signaturePath, photoPath } = parsed.data;
  if (!pattern.test(signaturePath) || (photoPath !== null && !pattern.test(photoPath))) {
    return { error: "Signature invalide." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment_receipt", {
    p_payment_ids: paymentIds,
    p_delivered_on: todayIso(),
    p_signer_name: signerName,
    p_signer_id_number: signerIdNumber ?? "",
    p_signature_path: signaturePath,
    p_photo_path: photoPath ?? undefined,
  });
  if (error || !data) {
    // Fichiers non retenus : retirés du stockage (non encore protégés par un accusé)
    await createAdminClient()
      .storage.from("cheques-scans")
      .remove([signaturePath, ...(photoPath ? [photoPath] : [])]);
    return { error: error && ["P0001", "22023"].includes(error.code) ? error.message : "Impossible d'enregistrer la remise. Réessayez." };
  }
  revalidatePath("/paiements", "layout");
  return { receiptId: data };
}

/** Reçu PDF envoyé par e-mail au fournisseur ; la date et l'adresse d'envoi sont conservées. */
export async function emailReceipt(receiptId: string, email: string): Promise<{ success?: string; error?: string }> {
  const organization = await requireRole(WRITER_ROLES);
  const id = z.uuid().safeParse(receiptId);
  const to = emailSchema.safeParse(email);
  if (!id.success || !to.success) {
    return { error: "Adresse e-mail invalide." };
  }
  const data = await getReceiptPdfData(id.data);
  if (!data) {
    return { error: "Accusé de réception introuvable." };
  }
  const pdf = await receiptPdf(data);
  const lines = [
    `Bonjour,`,
    ``,
    `Veuillez trouver ci-joint l'accusé de réception ${data.reference} : ${data.payments.length} valeur(s) pour un total de ${formatMAD(data.total)}, remises le ${formatDate(data.deliveredOn)} et reçues par ${data.signerName}.`,
    ``,
    `Cordialement,`,
    data.organization.name,
  ];
  const result = await sendEmail(
    {
      to: to.data,
      subject: `Accusé de réception de règlement ${data.reference} — ${data.organization.name}`,
      text: lines.join("\n"),
      html: lines.map((line) => (line ? `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "")).join(""),
      replyTo: data.organization.email ?? undefined,
      attachments: [{ filename: `accuse-${data.reference}.pdf`, content: pdf }],
    },
    // Un même reçu n'est pas envoyé deux fois à la même adresse par un double clic
    { idempotencyKey: `accuse/${organization.organizationId}/${id.data}/${to.data}/${Math.floor(Date.now() / 60_000)}` },
  );
  if (result.status === "disabled") {
    return { error: "L'envoi d'e-mails n'est pas configuré sur ce serveur." };
  }
  if (result.status === "failed") {
    console.error("Accusé de réception : envoi impossible", result.error);
    return { error: "L'envoi a échoué. Vérifiez l'adresse et réessayez." };
  }
  const supabase = await createClient();
  await supabase.rpc("mark_receipt_emailed", { p_receipt_id: id.data, p_email: to.data });
  revalidatePath(`/paiements/accuses/${id.data}`);
  return { success: `Reçu envoyé à ${to.data}.` };
}
