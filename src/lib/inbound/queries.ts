import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_INBOUND_DOMAIN, inboxAddress } from "./inbox";

/** Relevés reçus par e-mail (#37) : boîte de l'entreprise active. */

const SIGNED_URL_SECONDS = 10 * 60;

/** Réception configurée sur ce serveur (webhook Resend et clé de lecture). */
export function inboundConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_WEBHOOK_SECRET?.trim() && env.RESEND_INBOUND_KEY?.trim());
}

export async function getInbox() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const [org, items] = await Promise.all([
    supabase.from("organizations").select("statement_inbox_token").eq("id", organization.organizationId).single(),
    supabase
      .from("inbound_statements")
      .select("id, received_at, sender, subject, filename, size_bytes, status, statement_import_id")
      .eq("organization_id", organization.organizationId)
      .order("received_at", { ascending: false })
      .limit(30),
  ]);
  const token = org.data?.statement_inbox_token ?? null;
  const domain = process.env.INBOUND_EMAIL_DOMAIN?.trim() || DEFAULT_INBOUND_DOMAIN;
  return {
    configured: inboundConfigured(),
    address: token ? inboxAddress(token, domain) : null,
    pending: (items.data ?? []).filter((item) => item.status === "pending"),
    recent: (items.data ?? []).filter((item) => item.status !== "pending").slice(0, 5),
  };
}

/** Relevé reçu à importer : lien de courte durée vers le fichier, pour l'écran d'import. */
export async function getInboundForImport(id: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("inbound_statements")
    .select("id, filename, content_type, file_path, status, sender, received_at")
    .eq("organization_id", organization.organizationId)
    .eq("id", id)
    .maybeSingle();
  if (!data || data.status !== "pending") {
    return null;
  }
  const { data: signed } = await supabase.storage.from("releves").createSignedUrl(data.file_path, SIGNED_URL_SECONDS);
  return signed?.signedUrl
    ? { id: data.id, filename: data.filename, contentType: data.content_type, url: signed.signedUrl, sender: data.sender, receivedAt: data.received_at }
    : null;
}
