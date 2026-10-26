import { z } from "zod";
import { toCents } from "@/lib/amount";
import {
  amountSchema,
  dateSchema,
  optionalAmountSchema,
  optionalDateSchema,
  optionalText,
  requiredText,
} from "@/lib/validation";

/** Fichiers acceptés en pièce jointe d'une facture (bucket `factures`). */
export const ATTACHMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export const invoiceSchema = z
  .object({
    supplier_id: z.uuid({ error: "Choisissez un fournisseur." }),
    number: requiredText("Le numéro de facture", 60),
    issue_date: dateSchema("La date de facture"),
    delivery_date: optionalDateSchema,
    amount_excl_tax: optionalAmountSchema("Le montant HT"),
    vat_amount: optionalAmountSchema("La TVA"),
    amount_incl_tax: amountSchema("Le montant TTC"),
    payment_terms_days: z
      .string()
      .trim()
      .refine((value) => value === "" || (/^\d+$/.test(value) && Number(value) <= 365), {
        error: "Le délai doit être un nombre de jours entre 0 et 365.",
      })
      .transform((value) => (value === "" ? null : Number(value)))
      .optional(),
    notes: optionalText(2000),
  })
  .refine((data) => data.amount_incl_tax > 0, {
    error: "Le montant TTC doit être supérieur à zéro.",
    path: ["amount_incl_tax"],
  })
  .refine(
    (data) =>
      data.amount_excl_tax == null ||
      data.vat_amount == null ||
      toCents(data.amount_excl_tax) + toCents(data.vat_amount) === toCents(data.amount_incl_tax),
    { error: "HT + TVA doit être égal au montant TTC.", path: ["amount_incl_tax"] },
  );

export type InvoiceInput = z.infer<typeof invoiceSchema>;

/** Chemin de stockage d'une pièce jointe : `<organisation>/<facture>/<fichier>`. */
export function attachmentPath(organizationId: string, invoiceId: string, fileName: string, unique: string) {
  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return `${organizationId}/${invoiceId}/${unique}${extension ? `.${extension}` : ""}`;
}

/** Vérifie qu'un chemin de pièce jointe appartient bien à cette facture de cette organisation. */
export function isAttachmentPathOf(path: string, organizationId: string, invoiceId: string) {
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9-]+(\.[a-z0-9]+)?$/.test(path) && path.startsWith(`${organizationId}/${invoiceId}/`);
}
