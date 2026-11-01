import { isStatementAttachment, MAX_ATTACHMENTS, tokenFromRecipients } from "./inbox";

/**
 * Traitement d'un e-mail reçu par Resend (webhook « email.received ») : l'entreprise est
 * retrouvée par le jeton de l'adresse de réception, puis chaque relevé joint est téléchargé
 * et rangé dans sa boîte. Dépendances injectées (API Resend, base, stockage) pour les tests.
 */
export type InboundConfig = { apiKey: string; domain: string; /** API Resend (faux service pendant les tests). */ baseUrl?: string };

const RESEND_API = "https://api.resend.com";

type ReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  cc?: string[] | null;
  received_for?: string[] | null;
  subject: string | null;
};
type ReceivedAttachment = {
  id: string;
  filename: string | null;
  size: number | null;
  content_type: string | null;
  content_disposition?: string | null;
  download_url: string;
};

export type SavedAttachment = { attachmentId: string; filename: string; contentType: string | null; size: number; bytes: Uint8Array };

export type ReceiveDeps = {
  config: InboundConfig;
  fetchImpl?: typeof fetch;
  /** Entreprise de l'adresse de réception, ou null (adresse inconnue ou renouvelée). */
  findOrganization: (token: string) => Promise<string | null>;
  /** Range le fichier et l'inscrit dans la boîte ; sans effet si déjà reçu (webhook rejoué). */
  saveAttachment: (organizationId: string, email: { from: string; subject: string | null }, file: SavedAttachment) => Promise<void>;
};

export type ReceiveResult = { status: "saved"; organizationId: string; count: number } | { status: "ignored"; reason: string };

export class InboundError extends Error {}

async function api<T>(path: string, { config, fetchImpl = fetch }: Pick<ReceiveDeps, "config" | "fetchImpl">): Promise<T> {
  const response = await fetchImpl(`${config.baseUrl ?? RESEND_API}${path}`, { headers: { Authorization: `Bearer ${config.apiKey}` } });
  if (!response.ok) {
    throw new InboundError(`Resend ${response.status} sur ${path}`);
  }
  return (await response.json()) as T;
}

export async function receiveStatements(emailId: string, deps: ReceiveDeps): Promise<ReceiveResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const email = await api<ReceivedEmail>(`/emails/receiving/${encodeURIComponent(emailId)}`, deps);
  const recipients = [...(email.to ?? []), ...(email.cc ?? []), ...(email.received_for ?? [])];
  const token = tokenFromRecipients(recipients, deps.config.domain);
  if (!token) {
    return { status: "ignored", reason: "Aucune adresse de réception de relevés parmi les destinataires." };
  }
  const organizationId = await deps.findOrganization(token);
  if (!organizationId) {
    return { status: "ignored", reason: "Adresse de réception inconnue ou renouvelée." };
  }

  const { data } = await api<{ data: ReceivedAttachment[] }>(`/emails/receiving/${encodeURIComponent(emailId)}/attachments`, deps);
  const statements = data.filter(isStatementAttachment).slice(0, MAX_ATTACHMENTS);
  for (const attachment of statements) {
    const response = await fetchImpl(attachment.download_url);
    if (!response.ok) {
      throw new InboundError(`Téléchargement de ${attachment.filename} impossible (${response.status}).`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    await deps.saveAttachment(
      organizationId,
      { from: email.from, subject: email.subject },
      { attachmentId: attachment.id, filename: attachment.filename!, contentType: attachment.content_type, size: bytes.byteLength, bytes },
    );
  }
  return statements.length > 0
    ? { status: "saved", organizationId, count: statements.length }
    : { status: "ignored", reason: "Aucun relevé (PDF, Excel, CSV ou photo) en pièce jointe." };
}
