import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Relevés reçus par e-mail (#37) : adresse de réception de chaque entreprise, pièces
 * jointes acceptées et vérification de la signature des webhooks Resend (format Svix).
 */

/** Domaine de réception par défaut (enregistrement MX vers Resend). */
export const DEFAULT_INBOUND_DOMAIN = "import.mesvaleurs.ma";
/** Pièces jointes retenues par e-mail, au plus. */
export const MAX_ATTACHMENTS = 10;
/** Comme l'import manuel : 20 Mo au plus. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
/** Écart toléré entre l'horodatage du webhook et l'heure du serveur. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export function inboxAddress(token: string, domain = DEFAULT_INBOUND_DOMAIN): string {
  return `releves-${token}@${domain}`;
}

/** Jeton de l'entreprise destinataire, d'après les adresses du message (À, Cc, transferts). */
export function tokenFromRecipients(recipients: string[], domain = DEFAULT_INBOUND_DOMAIN): string | null {
  const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[<\\s])releves-([a-z0-9]{12})@${escaped}(?:$|[>\\s])`, "i");
  for (const recipient of recipients) {
    const match = recipient.trim().match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

const EXTENSIONS = /\.(pdf|csv|txt|xls|xlsx|jpe?g|png)$/i;

/** Pièce jointe lisible par l'import des relevés (PDF, Excel, CSV, photo), hors images insérées dans le message. */
export function isStatementAttachment(attachment: { filename: string | null; size: number | null; content_disposition?: string | null }): boolean {
  return Boolean(
    attachment.filename &&
      EXTENSIONS.test(attachment.filename) &&
      attachment.content_disposition !== "inline" &&
      (attachment.size ?? 0) > 0 &&
      (attachment.size ?? 0) <= MAX_ATTACHMENT_BYTES,
  );
}

/** Nom de fichier sûr pour le stockage (lettres, chiffres, tirets), extension conservée. */
export function storageFileName(filename: string): string {
  const extension = filename.match(EXTENSIONS)?.[0].toLowerCase() ?? "";
  const base = filename
    .slice(0, filename.length - extension.length)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "releve"}${extension}`;
}

/**
 * Signature d'un webhook Resend (Svix) : HMAC-SHA256 de « id.horodatage.corps » avec la
 * clé du secret « whsec_… » ; l'en-tête peut porter plusieurs signatures « v1,… ».
 */
export function verifyWebhookSignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  now = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) {
    return false;
  }
  if (Math.abs(now / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) {
      return false;
    }
    const received = Buffer.from(value, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}
