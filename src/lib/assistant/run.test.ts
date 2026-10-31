import { describe, expect, it, vi } from "vitest";
import type { AiChatResult, AiMessage } from "@/lib/ai/openrouter";
import { assistantInstructions, MAX_STEPS, runAssistant } from "./run";

const usage = { inputTokens: 100, outputTokens: 20, cost: 0.0001 };
const reply = (content: string): AiChatResult => ({ content, toolCalls: [], model: "test/model", usage });
const toolCall = (name: string, args: object, id = "c1"): AiChatResult => ({
  content: null,
  toolCalls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
  model: "test/model",
  usage,
});
const tools = [{ type: "function" as const, function: { name: "rechercher_fournisseurs", description: "", parameters: {} } }];

describe("runAssistant", () => {
  it("appelle les outils demandés puis renvoie la réponse, consommation cumulée", async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(toolCall("rechercher_fournisseurs", { recherche: "Sotrama" }))
      .mockResolvedValueOnce(reply("Vous devez 12 000,00 DH à [Sotrama](/fournisseurs/1)."));
    const runTool = vi.fn(async () => ({ fournisseurs: [{ nom: "Sotrama", solde_du: 12000 }] }));
    const result = await runAssistant("Consignes", [{ role: "user", content: "Combien je dois à Sotrama ?" }], { chat, runTool, tools });

    expect(result).toEqual({ answer: "Vous devez 12 000,00 DH à [Sotrama](/fournisseurs/1).", model: "test/model", usage: { inputTokens: 200, outputTokens: 40, cost: 0.0002 }, steps: 2 });
    expect(runTool).toHaveBeenCalledWith("rechercher_fournisseurs", '{"recherche":"Sotrama"}');
    const secondRequest = chat.mock.calls[1][0];
    expect(secondRequest.messages.at(-1)).toEqual({ role: "tool", tool_call_id: "c1", content: '{"fournisseurs":[{"nom":"Sotrama","solde_du":12000}]}' });
    expect(secondRequest.tools).toBe(tools);
  });

  it("erreur d'un outil transmise au modèle sans interrompre la réponse", async () => {
    const chat = vi.fn().mockResolvedValueOnce(toolCall("tresorerie", {})).mockResolvedValueOnce(reply("Données indisponibles."));
    const runTool = vi.fn(async () => {
      throw new Error("base indisponible");
    });
    await runAssistant("Consignes", [{ role: "user", content: "Trésorerie ?" }], { chat, runTool, tools });
    expect(chat.mock.calls[1][0].messages.at(-1).content).toBe('{"erreur":"Données indisponibles pour le moment."}');
  });

  it("au dernier échange, plus d'outils : réponse obligatoire", async () => {
    const chat = vi.fn(async (request: { tools?: unknown }) => (request.tools ? toolCall("lister_factures", {}) : reply("Synthèse.")));
    const result = await runAssistant("Consignes", [{ role: "user", content: "?" }], { chat, runTool: async () => ({}), tools });
    expect(result.steps).toBe(MAX_STEPS);
    expect(result.answer).toBe("Synthèse.");
    expect(chat).toHaveBeenCalledTimes(MAX_STEPS);
  });

  it("historique limité aux derniers messages, consignes en tête", async () => {
    const chat = vi.fn<(request: { messages: AiMessage[] }) => Promise<AiChatResult>>(async () => reply("ok"));
    const history = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: `m${i}` }));
    await runAssistant("Consignes", history, { chat, runTool: async () => ({}), tools });
    const { messages } = chat.mock.calls[0][0];
    expect(messages).toHaveLength(11);
    expect(messages[0]).toEqual({ role: "system", content: "Consignes" });
    expect(messages[1].content).toBe("m5");
  });
});

describe("assistantInstructions", () => {
  it("entreprise et date du jour", () => {
    const text = assistantInstructions({ organizationName: "Atlas Distribution SARL", today: "2026-10-31" });
    expect(text).toContain("Entreprise : Atlas Distribution SARL.");
    expect(text).toContain("Aujourd'hui : 31/10/2026 (2026-10-31).");
  });
});
