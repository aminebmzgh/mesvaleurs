"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { maskPersonalData } from "@/lib/ai/mask";
import { type AiContentPart, aiConfig, AiServiceError, completeJson } from "@/lib/ai/openrouter";
import { getAiStatus } from "@/lib/ai/usage";
import { requireRole, requireUser } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { todayIso } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { AI_INVOICE_JSON_SCHEMA, AI_READING_INSTRUCTIONS, type AiInvoice, aiPaymentTermsDays, AiReadingError, parseAiInvoice } from "@/lib/invoices/ai-reading";
import { detectInvoiceAnomalies, type InvoiceAnomaly } from "@/lib/invoices/anomalies";
import { findDuplicate, findSupplier, organizationIce } from "@/lib/invoices/supplier-match";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { iceSchema, optionalText, requiredText } from "@/lib/validation";

/** Texte d'un PDF (déjà extrait par le navigateur), ou images des pages / de la photo. */
const MAX_TEXT_LENGTH = 30_000;
const MAX_IMAGES = 3;
/** Image JPEG en data URL, réduite par le navigateur (environ 1 Mo au plus). */
const MAX_IMAGE_LENGTH = 1_300_000;

const readingSchema = z.union([
  z.object({ text: z.string().trim().min(20).max(MAX_TEXT_LENGTH) }),
  z.object({
    images: z
      .array(z.string().max(MAX_IMAGE_LENGTH).regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/))
      .min(1)
      .max(MAX_IMAGES),
  }),
]);

export type AiReadingResult = {
  invoice: AiInvoice;
  supplier: { id: string; name: string } | null;
  anomalies: InvoiceAnomaly[];
  paymentTermsDays: number | null;
  usage: { used: number; quota: number };
};

/**
 * Lecture d'une facture par l'IA : réservée aux entreprises qui l'ont activée, dans la
 * limite du quota mensuel. Le texte est envoyé sans les données personnelles ; une
 * image (scan, photo) est envoyée telle quelle. Rien n'est enregistré : le résultat
 * pré-remplit le formulaire, que l'utilisateur vérifie.
 */
export async function readInvoiceWithAi(input: z.infer<typeof readingSchema>): Promise<AiReadingResult | { error: string }> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = readingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Document illisible ou trop volumineux." };
  }
  const supabase = await createClient();
  const status = await getAiStatus(supabase, organization.organizationId);
  const config = aiConfig();
  if (!config || !status.configured) {
    return { error: "La lecture par IA n'est pas disponible sur ce serveur." };
  }
  if (!status.enabled) {
    return { error: "La lecture par IA est désactivée pour votre entreprise. Un administrateur peut l'activer dans les paramètres." };
  }

  const admin = createAdminClient();
  const user = await requireUser();
  const { data: usageId, error: reserveError } = await admin.rpc("reserve_ai_usage", {
    p_organization_id: organization.organizationId,
    p_user_id: user.id,
    p_feature: "invoice_reading",
    p_monthly_quota: status.quota,
  });
  if (reserveError) {
    // Clé service_role absente ou invalide, migration manquante… : détail dans les journaux du serveur
    console.error("IA : réservation du quota impossible", reserveError.code, reserveError.message);
    return { error: "Impossible de lancer la lecture. Réessayez." };
  }
  if (!usageId) {
    return { error: `Quota de lectures par IA atteint pour ce mois (${status.quota}). Saisissez la facture à la main, ou demandez à un administrateur d'augmenter le quota.` };
  }

  const content: AiContentPart[] =
    "text" in parsed.data
      ? [{ type: "text", text: `Texte de la facture :\n\n${maskPersonalData(parsed.data.text)}` }]
      : [{ type: "text", text: "Image(s) de la facture :" }, ...parsed.data.images.map((url) => ({ type: "image_url" as const, image_url: { url } }))];

  let invoice: AiInvoice;
  try {
    const completion = await completeJson(
      { instructions: AI_READING_INSTRUCTIONS, content, schema: AI_INVOICE_JSON_SCHEMA },
      { config, siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL },
    );
    await admin
      .from("ai_usages")
      .update({
        model: completion.model,
        input_tokens: completion.usage.inputTokens,
        output_tokens: completion.usage.outputTokens,
        cost: completion.usage.cost,
        succeeded: true,
      })
      .eq("id", usageId);
    invoice = parseAiInvoice(completion.content);
  } catch (error) {
    await admin.from("ai_usages").update({ succeeded: false }).eq("id", usageId);
    if (error instanceof AiServiceError || error instanceof AiReadingError) {
      return { error: error.message };
    }
    throw error;
  }

  const orgId = organization.organizationId;
  const supplier = await findSupplier(supabase, orgId, invoice.supplier);
  const [duplicate, history, ice] = await Promise.all([
    supplier && invoice.number ? findDuplicate(supabase, orgId, supplier.id, invoice.number) : null,
    supplier
      ? supabase
          .from("invoices")
          .select("amount_incl_tax")
          .eq("organization_id", orgId)
          .eq("supplier_id", supplier.id)
          .order("issue_date", { ascending: false })
          .limit(24)
          .then(({ data }) => (data ?? []).map((row) => Number(row.amount_incl_tax)))
      : [],
    organizationIce(supabase, orgId),
  ]);
  return {
    invoice,
    supplier,
    anomalies: detectInvoiceAnomalies(invoice, { duplicate, supplierHistory: history, organizationIce: ice, today: todayIso() }),
    paymentTermsDays: aiPaymentTermsDays(invoice),
    usage: { used: status.used + 1, quota: status.quota },
  };
}

const supplierSchema = z.object({
  name: requiredText("La raison sociale"),
  ice: iceSchema,
  tax_id: optionalText(30),
  trade_register: optionalText(60),
  city: optionalText(120),
});

/** Fournisseur lu sur la facture, inconnu : créé après confirmation de l'utilisateur. */
export async function createSupplierFromReading(input: z.input<typeof supplierSchema>): Promise<{ supplier?: { id: string; name: string }; error?: string }> {
  const organization = await requireRole(WRITER_ROLES);
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Informations du fournisseur invalides : créez-le depuis la page Fournisseurs." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ ...parsed.data, organization_id: organization.organizationId, notes: "Créé à la lecture d'une facture par IA." })
    .select("id, name")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "Un fournisseur avec cet ICE existe déjà." : "Impossible de créer le fournisseur." };
  }
  revalidatePath("/fournisseurs");
  return { supplier: data };
}
