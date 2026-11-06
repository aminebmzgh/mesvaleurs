import { effectivePlan, hasFeature } from "@/lib/billing/plans";
import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_INBOUND_DOMAIN, storageFileName, verifyWebhookSignature } from "@/lib/inbound/inbox";
import { InboundError, receiveStatements } from "@/lib/inbound/receive";
import { createAdminClient } from "@/lib/supabase/admin";

/** Téléchargement de plusieurs relevés : laisser le temps. */
export const maxDuration = 60;

/**
 * Webhook Resend « email.received » : relevés envoyés à l'adresse de réception d'une
 * entreprise. Authentifié par sa signature (RESEND_WEBHOOK_SECRET) ; lecture de l'e-mail
 * par l'API de réception (RESEND_INBOUND_KEY, clé à accès complet). Toute erreur renvoie
 * 500 : Resend rejoue le webhook, sans doublon (pièce jointe unique par identifiant).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const apiKey = process.env.RESEND_INBOUND_KEY?.trim();
  if (!secret || !apiKey) {
    return NextResponse.json({ error: "Réception des relevés non configurée." }, { status: 503 });
  }
  const body = await request.text();
  const signed = verifyWebhookSignature(
    secret,
    { id: request.headers.get("svix-id"), timestamp: request.headers.get("svix-timestamp"), signature: request.headers.get("svix-signature") },
    body,
  );
  if (!signed) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Corps illisible." }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data?.email_id) {
    return NextResponse.json({ status: "ignored" });
  }

  const admin = createAdminClient();
  try {
    const result = await receiveStatements(event.data.email_id, {
      config: {
        apiKey,
        domain: process.env.INBOUND_EMAIL_DOMAIN?.trim() || DEFAULT_INBOUND_DOMAIN,
        baseUrl: process.env.RESEND_API_URL?.trim() || undefined,
      },
      findOrganization: async (token) => {
        const { data } = await admin
          .from("organizations")
          .select("id, subscriptions ( plan, trial_ends_at )")
          .eq("statement_inbox_token", token)
          .maybeSingle();
        // Relevés par e-mail : offres Pro et supérieures (hors offre : e-mail ignoré)
        return data && hasFeature(effectivePlan(data.subscriptions), "statement_inbox") ? data.id : null;
      },
      saveAttachment: async (organizationId, email, file) => {
        const { data: existing } = await admin.from("inbound_statements").select("id").eq("provider_attachment_id", file.attachmentId).maybeSingle();
        if (existing) {
          return;
        }
        const path = `${organizationId}/boite/${crypto.randomUUID()}-${storageFileName(file.filename)}`;
        const { error: uploadError } = await admin.storage
          .from("releves")
          .upload(path, file.bytes, { contentType: file.contentType ?? "application/octet-stream", upsert: false });
        if (uploadError) {
          throw new InboundError(`Stockage impossible : ${uploadError.message}`);
        }
        const { error } = await admin.from("inbound_statements").insert({
          organization_id: organizationId,
          sender: email.from.slice(0, 320),
          subject: email.subject?.slice(0, 500) ?? null,
          filename: file.filename.slice(0, 255),
          content_type: file.contentType,
          size_bytes: file.size,
          file_path: path,
          provider_attachment_id: file.attachmentId,
        });
        if (error) {
          await admin.storage.from("releves").remove([path]);
          // Course entre deux webhooks rejoués : déjà enregistré
          if (error.code !== "23505") {
            throw new InboundError(`Enregistrement impossible : ${error.message}`);
          }
        }
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Relevés reçus par e-mail :", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Traitement impossible, à rejouer." }, { status: 500 });
  }
}
