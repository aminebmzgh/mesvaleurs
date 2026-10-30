import "server-only";

/**
 * Envoi d'e-mails par l'API Resend. Sans RESEND_API_KEY ni EMAIL_FROM (domaine d'envoi
 * pas encore vérifié), l'envoi est désactivé : rien ne part, le résultat le signale.
 */

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
/** Messages par appel à l'API (limite de l'envoi groupé Resend). */
const BATCH_SIZE = 100;

export type EmailMessage = { to: string; subject: string; text: string; html: string };

export type SendResult = { status: "sent"; count: number } | { status: "disabled" } | { status: "failed"; error: string };

export type EmailConfig = { apiKey: string; from: string };

export function emailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

/**
 * Envoie chaque message à son seul destinataire (aucune adresse partagée). La clé
 * d'idempotence évite un double envoi si la tâche est relancée.
 */
export async function sendEmails(
  messages: EmailMessage[],
  { idempotencyKey, config = emailConfig(), fetchImpl = fetch }: { idempotencyKey: string; config?: EmailConfig | null; fetchImpl?: typeof fetch },
): Promise<SendResult> {
  if (!config) {
    return { status: "disabled" };
  }
  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    const chunk = messages.slice(start, start + BATCH_SIZE);
    try {
      const response = await fetchImpl(RESEND_BATCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${idempotencyKey}/${start / BATCH_SIZE}`,
        },
        body: JSON.stringify(chunk.map((m) => ({ from: config.from, to: [m.to], subject: m.subject, text: m.text, html: m.html }))),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return { status: "failed", error: `Resend ${response.status} ${body}`.slice(0, 500) };
      }
    } catch (error) {
      return { status: "failed", error: (error instanceof Error ? error.message : String(error)).slice(0, 500) };
    }
  }
  return { status: "sent", count: messages.length };
}
