import { formatDate, formatMAD } from "@/lib/format";

/**
 * Lien de relance d'un fournisseur pour un chèque non encaissé (spec §11 bis F) :
 * ouvre la messagerie avec l'objet et le message pré-remplis.
 */
export function reminderMailto({
  email,
  contactName,
  label,
  issueDate,
  amount,
  organizationName,
}: {
  email: string;
  contactName: string | null;
  label: string;
  issueDate: string;
  amount: number;
  organizationName: string;
}): string {
  const subject = `${label} du ${formatDate(issueDate)} non encaissé`;
  const body = [
    contactName ? `Bonjour ${contactName},` : "Bonjour,",
    "",
    `Sauf erreur de notre part, notre ${label.toLowerCase()} de ${formatMAD(amount)}, émis le ${formatDate(issueDate)}, n'a pas encore été présenté à l'encaissement.`,
    "Pourriez-vous nous confirmer sa bonne réception et la date prévue de remise en banque ?",
    "",
    "Cordialement,",
    organizationName,
  ].join("\n");
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
