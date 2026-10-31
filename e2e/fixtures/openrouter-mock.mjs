/**
 * Faux service OpenRouter pour les tests de bout en bout : aucune facture n'est envoyée
 * au vrai service. La « lecture » reprend les lignes « clé: valeur » du texte reçu
 * (factures PDF fabriquées par les tests). GET /last renvoie le dernier texte reçu,
 * pour vérifier le masquage des données personnelles.
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
      const user = payload.messages.find((message) => message.role === "user");
      lastText = user.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
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
