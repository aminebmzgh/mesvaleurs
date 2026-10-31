/**
 * Faux service OpenRouter pour les tests de bout en bout : aucune facture n'est envoyée
 * au vrai service. La « lecture » reprend les lignes « clé: valeur » du texte reçu
 * (factures PDF fabriquées par les tests). GET /last renvoie le dernier texte reçu,
 * pour vérifier le masquage des données personnelles.
 *
 * Assistant (requête avec outils) : la dernière question choisit l'outil appelé
 * (mots-clés ci-dessous) ; une fois le résultat reçu, la réponse en reprend le nombre,
 * le total et le premier lien.
 */
import http from "node:http";

const PORT = Number(process.env.OPENROUTER_MOCK_PORT ?? 3101);
const FIELDS = [
  "supplier_name",
  "supplier_ice",
  "supplier_tax_id",
  "supplier_trade_register",
  "supplier_city",
  "customer_ice",
  "number",
  "issue_date",
  "due_date",
  "delivery_date",
  "currency",
  "amount_excl_tax",
  "vat_amount",
  "amount_incl_tax",
];
const NUMBERS = new Set(["amount_excl_tax", "vat_amount", "amount_incl_tax"]);

let lastText = "";

/** Outil appelé selon la question posée à l'assistant. */
function toolFor(question) {
  if (/dois|fournisseur/i.test(question)) {
    return { name: "rechercher_fournisseurs", arguments: { recherche: "Sotrama" } };
  }
  if (/amende|retard/i.test(question)) {
    return { name: "delais_de_paiement", arguments: { horizon_jours: 30 } };
  }
  if (/trésorerie/i.test(question)) {
    return { name: "tresorerie", arguments: { jours: 30 } };
  }
  return { name: "lister_paiements", arguments: { statut: "en_circulation" } };
}

/** Premier champ « nom » trouvé dans le résultat d'un outil (parcours en profondeur). */
function first(value, key) {
  if (value && typeof value === "object") {
    if (key in value && !Array.isArray(value)) {
      return value[key];
    }
    for (const child of Object.values(value)) {
      const found = first(child, key);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

function assistantReply(payload) {
  const last = payload.messages.at(-1);
  if (last.role === "tool") {
    const result = JSON.parse(last.content);
    const link = first(result, "lien") ?? first(result, "page");
    const parts = [`Réponse du faux assistant : ${first(result, "nombre") ?? "?"} résultat(s)`];
    const total = first(result, "total") ?? first(result, "solde_du") ?? first(result, "solde_total_actuel");
    if (total !== undefined) {
      parts.push(`montant ${total}`);
    }
    return { role: "assistant", content: `${parts.join(", ")}.${link ? ` [Voir le détail](${link})` : ""}` };
  }
  const call = toolFor(last.content);
  return {
    role: "assistant",
    content: null,
    tool_calls: [{ id: "appel-1", type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } }],
  };
}

function read(text) {
  const invoice = { is_invoice: true };
  for (const field of FIELDS) {
    const match = text.match(new RegExp(`${field}: *([^\\n]+?) *(?:\\n|$)`));
    const value = match ? match[1].trim() : null;
    invoice[field] = value === null ? null : NUMBERS.has(field) ? Number(value) : value;
  }
  return invoice;
}

http
  .createServer((request, response) => {
    if (request.method === "GET" && request.url === "/last") {
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(lastText);
      return;
    }
    if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
      response.writeHead(404);
      response.end();
      return;
    }
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const payload = JSON.parse(body);
      const user = payload.messages.findLast((message) => message.role === "user");
      lastText =
        typeof user.content === "string"
          ? user.content
          : user.content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n");
      if (payload.tools || payload.messages.some((message) => message.role === "tool")) {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            model: payload.model,
            choices: [{ message: assistantReply(payload) }],
            usage: { prompt_tokens: 900, completion_tokens: 60, cost: 0.0002 },
          }),
        );
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          model: payload.model,
          choices: [{ message: { role: "assistant", content: JSON.stringify(read(lastText)) } }],
          usage: { prompt_tokens: 500, completion_tokens: 80, cost: 0.0001 },
        }),
      );
    });
  })
  .listen(PORT, () => console.log(`Faux OpenRouter sur le port ${PORT}`));
