import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { aiConfig, AiServiceError, completeJson, DEFAULT_AI_MODEL } = await import("./openrouter");

const config = { apiKey: "sk-or-test", model: "test/model", baseUrl: "https://ia.exemple.ma/v1" };
const request = { instructions: "Consignes", content: [{ type: "text" as const, text: "Facture" }], schema: { name: "s", strict: true, schema: {} } };

describe("aiConfig", () => {
  it("indisponible sans clé ; modèle et adresse par défaut", () => {
    expect(aiConfig({})).toBeNull();
    expect(aiConfig({ OPENROUTER_API_KEY: " " })).toBeNull();
    expect(aiConfig({ OPENROUTER_API_KEY: "k" })).toEqual({ apiKey: "k", model: DEFAULT_AI_MODEL, baseUrl: "https://openrouter.ai/api/v1" });
    expect(aiConfig({ OPENROUTER_API_KEY: "k", OPENROUTER_MODEL: "x/y", OPENROUTER_BASE_URL: "http://localhost:3101/v1/" })).toEqual({
      apiKey: "k",
      model: "x/y",
      baseUrl: "http://localhost:3101/v1",
    });
  });
});

describe("completeJson", () => {
  it("impose le format JSON et la non-conservation des données ; renvoie contenu et consommation", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ model: "test/model", choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 } }),
        ),
    );
    expect(await completeJson(request, { config, fetchImpl })).toEqual({
      content: '{"a":1}',
      model: "test/model",
      usage: { inputTokens: 10, outputTokens: 5, cost: 0.0001 },
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://ia.exemple.ma/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-or-test");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "test/model",
      response_format: { type: "json_schema", json_schema: request.schema },
      provider: { zdr: true, data_collection: "deny", require_parameters: true },
    });
    expect(body.messages[0]).toEqual({ role: "system", content: "Consignes" });
  });

  it("erreurs du service : message compréhensible", async () => {
    const status = (code: number) => vi.fn<typeof fetch>(async () => new Response("erreur", { status: code }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(completeJson(request, { config, fetchImpl: status(402) })).rejects.toThrow("Crédit du service d'IA épuisé");
    await expect(completeJson(request, { config, fetchImpl: status(500) })).rejects.toThrow(AiServiceError);
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(completeJson(request, { config, fetchImpl: offline })).rejects.toThrow("ne répond pas");
    const empty = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] })));
    await expect(completeJson(request, { config, fetchImpl: empty })).rejects.toThrow("Réponse vide");
  });
});

describe("chat", () => {
  it("réflexion du modèle désactivable pour un texte court", async () => {
    const { chat } = await import("./openrouter");
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] })));
    await chat({ messages: [{ role: "user", content: "x" }], reasoning: false }, { config, fetchImpl });
    await chat({ messages: [{ role: "user", content: "x" }] }, { config, fetchImpl });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).reasoning).toEqual({ enabled: false });
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).not.toHaveProperty("reasoning");
  });
});
