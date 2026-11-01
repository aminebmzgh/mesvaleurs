/**
 * Faux service Resend (réception d'e-mails) pour les tests de bout en bout. Le test
 * dépose un e-mail reçu par POST /__emails (destinataires, objet, pièces jointes), puis
 * appelle le webhook de l'application ; l'application relit l'e-mail et ses pièces jointes
 * ici, comme sur l'API de réception de Resend.
 */
import http from "node:http";

const PORT = Number(process.env.RESEND_MOCK_PORT ?? 3102);
const BASE = `http://localhost:${PORT}`;
/** id → { email, attachments: [{ meta, content }] } */
const emails = new Map();

const json = (response, status, body) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};

http
  .createServer((request, response) => {
    const url = new URL(request.url, BASE);
    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true });
    }
    if (request.method === "POST" && url.pathname === "/__emails") {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        const { id, from, to, subject, attachments } = JSON.parse(body);
        emails.set(id, {
          email: { object: "email", id, from, to, cc: [], received_for: [], subject, created_at: new Date().toISOString() },
          attachments: attachments.map((file, index) => ({
            meta: {
              id: `${id}-att-${index}`,
              filename: file.filename,
              size: Buffer.byteLength(file.content),
              content_type: file.contentType,
              content_disposition: file.inline ? "inline" : "attachment",
              download_url: `${BASE}/files/${id}/${index}`,
            },
            content: file.content,
          })),
        });
        json(response, 201, { id });
      });
      return;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (request.method === "GET" && parts[0] === "emails" && parts[1] === "receiving") {
      const stored = emails.get(parts[2]);
      if (!stored) {
        return json(response, 404, { message: "Email not found" });
      }
      return parts[3] === "attachments"
        ? json(response, 200, { object: "list", has_more: false, data: stored.attachments.map((a) => a.meta) })
        : json(response, 200, stored.email);
    }
    if (request.method === "GET" && parts[0] === "files") {
      const file = emails.get(parts[1])?.attachments[Number(parts[2])];
      if (!file) {
        response.writeHead(404);
        return response.end();
      }
      response.writeHead(200, { "Content-Type": file.meta.content_type });
      return response.end(file.content);
    }
    response.writeHead(404);
    response.end();
  })
  .listen(PORT, () => console.log(`Faux Resend sur le port ${PORT}`));
