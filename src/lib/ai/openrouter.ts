import "server-only";

/**
 * Appel d'un modèle d'IA par OpenRouter (API compatible OpenAI). Les données ne sont
 * confiées qu'aux fournisseurs qui ne les conservent pas et ne s'en servent pas pour
 * l'entraînement (zdr, data_collection: deny).
 */

/** Modèle par défaut : économique, lit les images et respecte un format JSON imposé. */
export const DEFAULT_AI_MODEL = "anthropic/claude-haiku-5.5";
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 60_000;

export type AiConfig = { apiKey: string; model: string; baseUrl: string };

type Env = Record<string, string | undefined>;

/** Configuration lue dans l'environnement ; null sans clé (IA indisponible). */
export function aiConfig(env: Env = process.env): AiConfig | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return {
    apiKey,
    model: env.OPENROUTER_MODEL?.trim() || DEFAULT_AI_MODEL,
    baseUrl: (env.OPENROUTER_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, ""),
  };
}

export type AiContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type AiUsage = { inputTokens: number | null; outputTokens: number | null; cost: number | null };

export type AiCompletion = { content: string; model: string | null; usage: AiUsage };

export type AiToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

/** Messages d'une conversation (format OpenAI, repris par OpenRouter). */
export type AiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | AiContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: AiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type AiTool = { type: "function"; function: { name: string; description: string; parameters: object } };

export type AiChatResult = { content: string | null; toolCalls: AiToolCall[]; model: string | null; usage: AiUsage };

export class AiServiceError extends Error {}

const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Un échange avec le modèle : réponse texte, ou demandes d'appel d'outils. */
export async function chat(
  {
    messages,
    tools,
    responseFormat,
    maxTokens = 1500,
  }: { messages: AiMessage[]; tools?: AiTool[]; responseFormat?: object; maxTokens?: number },
  { config, fetchImpl = fetch, siteUrl }: { config: AiConfig; fetchImpl?: typeof fetch; siteUrl?: string },
): Promise<AiChatResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "MesValeurs",
        ...(siteUrl && { "HTTP-Referer": siteUrl }),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        ...(tools && { tools }),
        ...(responseFormat && { response_format: responseFormat }),
        // Pas de « temperature » : refusée par certains modèles (require_parameters exclurait tout fournisseur)
        max_tokens: maxTokens,
        provider: { zdr: true, data_collection: "deny", require_parameters: true },
        usage: { include: true },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AiServiceError("Le service d'IA ne répond pas. Réessayez dans un instant.");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`OpenRouter ${response.status}: ${detail.slice(0, 500)}`);
    throw new AiServiceError(
      response.status === 402
        ? "Crédit du service d'IA épuisé : prévenez l'administrateur de MesValeurs."
        : response.status === 429
          ? "Service d'IA très sollicité : réessayez dans un instant."
          : "Le service d'IA n'a pas pu répondre. Réessayez.",
    );
  }

  const body = (await response.json().catch(() => null)) as {
    model?: string;
    choices?: { message?: { content?: string | null; tool_calls?: AiToolCall[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  } | null;
  const message = body?.choices?.[0]?.message;
  const toolCalls = (message?.tool_calls ?? []).filter((call) => call?.type === "function" && typeof call.function?.name === "string");
  const content = typeof message?.content === "string" && message.content.trim() !== "" ? message.content : null;
  if (content === null && toolCalls.length === 0) {
    throw new AiServiceError("Réponse vide du service d'IA. Réessayez.");
  }
  return {
    content,
    toolCalls,
    model: body?.model ?? null,
    usage: {
      inputTokens: number(body?.usage?.prompt_tokens),
      outputTokens: number(body?.usage?.completion_tokens),
      cost: number(body?.usage?.cost),
    },
  };
}

/** Réponse au format JSON imposé (sorties structurées). */
export async function completeJson(
  {
    instructions,
    content,
    schema,
    maxTokens = 1500,
  }: { instructions: string; content: AiContentPart[]; schema: { name: string; strict: boolean; schema: object }; maxTokens?: number },
  options: { config: AiConfig; fetchImpl?: typeof fetch; siteUrl?: string },
): Promise<AiCompletion> {
  const result = await chat(
    {
      messages: [
        { role: "system", content: instructions },
        { role: "user", content },
      ],
      responseFormat: { type: "json_schema", json_schema: schema },
      maxTokens,
    },
    options,
  );
  if (result.content === null) {
    throw new AiServiceError("Réponse vide du service d'IA. Réessayez.");
  }
  return { content: result.content, model: result.model, usage: result.usage };
}
