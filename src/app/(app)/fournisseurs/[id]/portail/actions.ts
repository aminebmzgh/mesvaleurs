"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { planError } from "@/lib/billing/guard";
import { sendEmail } from "@/lib/email/send";
import { portalEmail } from "@/lib/suppliers/portal-email";
import { getSupplierPortalLink } from "@/lib/suppliers/portal-queries";
import { createClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validation";

export type PortalActionResult = { error?: string; success?: string };

/** Crée le lien du portail, ou le remplace (l'ancien cesse aussitôt de fonctionner). */
export async function renewPortalLink(supplierId: string): Promise<PortalActionResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const blocked = planError(organization, "supplier_portal");
  if (blocked) {
    return { error: blocked };
  }
  const id = z.uuid().parse(supplierId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("renew_supplier_portal", { p_supplier_id: id });
  if (error) {
    return { error: error.code === "P0001" || error.code === "P0002" ? error.message : "Impossible de créer le lien. Réessayez." };
  }
  revalidatePath(`/fournisseurs/${id}`);
  return {};
}

/** Désactive le lien : le fournisseur ne peut plus consulter son suivi. */
export async function revokePortalLink(supplierId: string): Promise<PortalActionResult> {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const id = z.uuid().parse(supplierId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_supplier_portal", { p_supplier_id: id });
  if (error) {
    return { error: error.code === "P0002" ? error.message : "Impossible de désactiver le lien. Réessayez." };
  }
  revalidatePath(`/fournisseurs/${id}`);
  return {};
}

/** Envoie le lien actif au fournisseur par e-mail. */
export async function emailPortalLink(supplierId: string, email: string): Promise<PortalActionResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const blocked = planError(organization, "supplier_portal");
  if (blocked) {
    return { error: blocked };
  }
  const id = z.uuid().safeParse(supplierId);
  const to = emailSchema.safeParse(email);
  if (!id.success || !to.success) {
    return { error: "Adresse e-mail invalide." };
  }
  const supabase = await createClient();
  const [link, org, supplier] = await Promise.all([
    getSupplierPortalLink(id.data),
    supabase.from("organizations").select("name, email").eq("id", organization.organizationId).single(),
    supabase.from("suppliers").select("name").eq("id", id.data).eq("organization_id", organization.organizationId).maybeSingle(),
  ]);
  if (!link || !org.data || !supplier.data) {
    return { error: "Créez d'abord le lien du portail." };
  }
  const message = portalEmail({ organizationName: org.data.name, supplierName: supplier.data.name, url: link.url });
  const result = await sendEmail(
    {
      to: to.data,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: org.data.email ?? undefined,
    },
    // Pas de double envoi sur un double clic
    { idempotencyKey: `portail/${organization.organizationId}/${id.data}/${to.data}/${Math.floor(Date.now() / 60_000)}` },
  );
  if (result.status === "disabled") {
    return { error: "L'envoi d'e-mails n'est pas configuré sur ce serveur." };
  }
  if (result.status === "failed") {
    console.error("Portail fournisseur : envoi impossible", result.error);
    return { error: "L'envoi a échoué. Vérifiez l'adresse et réessayez." };
  }
  return { success: `Lien envoyé à ${to.data}.` };
}
