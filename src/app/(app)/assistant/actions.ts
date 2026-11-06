"use server";

import { upgradeMessage } from "@/lib/billing/plans";
import { z } from "zod";
import { maskPersonalData } from "@/lib/ai/mask";
import { aiConfig, AiServiceError, chat } from "@/lib/ai/openrouter";
import { getAiStatus } from "@/lib/ai/usage";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/assistant/tools";
import { assistantInstructions, MAX_HISTORY, MAX_QUESTION_LENGTH, runAssistant } from "@/lib/assistant/run";
import { requireActiveOrganization, requireUser } from "@/lib/auth/dal";
import { todayIso } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(8000) }))
  .min(1)
  .max(MAX_HISTORY * 2)
  .refine((turns) => turns.at(-1)!.role === "user" && turns.at(-1)!.content.length <= MAX_QUESTION_LENGTH);

export type AssistantReply = { answer: string; usage: { used: number; quota: number } } | { error: string };

/**
 * Question à l'assistant IA : réservée aux entreprises qui ont activé l'IA, dans la
 * limite du quota mensuel (une question = un appel). La conversation n'est pas
 * enregistrée ; les données personnelles des questions sont masquées avant l'envoi.
 */
export async function askAssistant(history: z.input<typeof historySchema>): Promise<AssistantReply> {
  const organization = await requireActiveOrganization();
  const parsed = historySchema.safeParse(history);
  if (!parsed.success) {
    return { error: `Question vide ou trop longue (${MAX_QUESTION_LENGTH} caractères au plus).` };
  }
  const supabase = await createClient();
  const status = await getAiStatus(supabase, organization.organizationId);
  const config = aiConfig();
  if (!config) {
    return { error: "L'assistant IA n'est pas disponible sur ce serveur." };
  }
  if (!status.included) {
    return { error: upgradeMessage("ai") };
  }
  if (!status.enabled) {
    return { error: "L'IA est désactivée pour votre entreprise. Un administrateur peut l'activer dans les paramètres." };
  }

  const user = await requireUser();
  const admin = createAdminClient();
  const { data: usageId, error: reserveError } = await admin.rpc("reserve_ai_usage", {
    p_organization_id: organization.organizationId,
    p_user_id: user.id,
    p_feature: "assistant",
    p_monthly_quota: status.quota,
  });
  if (reserveError) {
    // Clé service_role absente ou invalide, migration manquante… : détail dans les journaux du serveur
    console.error("IA : réservation du quota impossible", reserveError.code, reserveError.message);
    return { error: "Impossible d'envoyer la question. Réessayez." };
  }
  if (!usageId) {
    return { error: `Quota d'IA atteint pour ce mois (${status.quota} lectures et questions). Un administrateur peut l'augmenter.` };
  }

  const today = todayIso();
  const context = { supabase, organizationId: organization.organizationId, today };
  try {
    const result = await runAssistant(
      assistantInstructions({ organizationName: organization.organizationName, today }),
      parsed.data.map((turn) => ({ role: turn.role, content: maskPersonalData(turn.content) })),
      {
        chat: (request) => chat({ ...request, maxTokens: 1200 }, { config, siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL }),
        runTool: (name, args) => runAssistantTool(context, name, args),
        tools: ASSISTANT_TOOLS,
      },
    );
    await admin
      .from("ai_usages")
      .update({ model: result.model, input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens, cost: result.usage.cost, succeeded: true })
      .eq("id", usageId);
    return { answer: result.answer, usage: { used: status.used + 1, quota: status.quota } };
  } catch (error) {
    await admin.from("ai_usages").update({ succeeded: false }).eq("id", usageId);
    if (error instanceof AiServiceError) {
      return { error: error.message };
    }
    throw error;
  }
}
