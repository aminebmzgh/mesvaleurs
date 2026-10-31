import { z } from "zod";
import { daysBetween } from "@/lib/dates";

/**
 * Lecture d'une facture fournisseur par le modèle d'IA (spec §9) : consignes, format de
 * réponse imposé (JSON Schema) et contrôle de la réponse. Les valeurs lues ne sont qu'une
 * proposition : l'utilisateur les vérifie dans le formulaire avant d'enregistrer.
 */

export const AI_READING_INSTRUCTIONS = `Tu lis des factures de fournisseurs marocains pour pré-remplir une saisie comptable.
Réponds uniquement avec l'objet JSON demandé. Règles :
- Le fournisseur est l'entreprise qui émet la facture (en-tête, cachet), pas le client destinataire.
- ICE : 15 chiffres exactement, sans espace. IF, RC : tels qu'imprimés.
- Dates au format AAAA-MM-JJ. Les dates marocaines s'écrivent JJ/MM/AAAA.
- Montants en nombre décimal avec un point (12345.60), sans séparateur de milliers ni devise.
- amount_excl_tax = total HT, vat_amount = total TVA, amount_incl_tax = net à payer TTC (après remises, avant retenue à la source éventuelle).
- currency : code ISO (MAD pour dirhams, DH, Dhs).
- Valeur illisible ou absente : null. N'invente jamais une valeur.
- Les données personnelles ont pu être remplacées par [e-mail], [téléphone], [RIB] : ignore-les.
- is_invoice = false si le document n'est pas une facture (devis, bon de livraison, relevé…).`;

const nullableString = { type: ["string", "null"] } as const;
const nullableNumber = { type: ["number", "null"] } as const;

/** Format de réponse imposé au modèle (sorties structurées, mode strict). */
export const AI_INVOICE_JSON_SCHEMA = {
  name: "facture_fournisseur",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      is_invoice: { type: "boolean" },
      supplier_name: nullableString,
      supplier_ice: nullableString,
      supplier_tax_id: nullableString,
      supplier_trade_register: nullableString,
      supplier_city: nullableString,
      customer_ice: nullableString,
      number: nullableString,
      issue_date: nullableString,
      due_date: nullableString,
      delivery_date: nullableString,
      currency: nullableString,
      amount_excl_tax: nullableNumber,
      vat_amount: nullableNumber,
      amount_incl_tax: nullableNumber,
    },
    required: [
      "is_invoice",
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
    ],
  },
} as const;

export type AiInvoice = {
  isInvoice: boolean;
  supplier: { name: string | null; ice: string | null; taxId: string | null; tradeRegister: string | null; city: string | null };
  customerIce: string | null;
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  deliveryDate: string | null;
  currency: string | null;
  amountExclTax: number | null;
  vatAmount: number | null;
  amountInclTax: number | null;
};

export class AiReadingError extends Error {}

const text = (max: number) =>
  z
    .string()
    .nullable()
    .catch(null)
    .transform((value) => {
      const trimmed = value?.replace(/\s+/g, " ").trim() ?? "";
      return trimmed === "" ? null : trimmed.slice(0, max);
    });

const ice = z
  .string()
  .nullable()
  .catch(null)
  .transform((value) => {
    const digits = value?.replace(/[\s.-]/g, "") ?? "";
    return /^\d{15}$/.test(digits) ? digits : null;
  });

/** Date réelle au format AAAA-MM-JJ, entre 2000 et 2100. */
const isoDate = z
  .string()
  .nullable()
  .catch(null)
  .transform((value) => {
    const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const valid = year >= 2000 && year <= 2100 && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    return valid ? value!.trim() : null;
  });

/** Montant positif arrondi au centime, plafonné comme en base (numeric 14,2). */
const amount = z
  .number()
  .nullable()
  .catch(null)
  .transform((value) => (value !== null && Number.isFinite(value) && value >= 0 && value < 1e12 ? Math.round(value * 100) / 100 : null));

const responseSchema = z.object({
  is_invoice: z.boolean().catch(true),
  supplier_name: text(200),
  supplier_ice: ice,
  supplier_tax_id: text(30),
  supplier_trade_register: text(60),
  supplier_city: text(120),
  customer_ice: ice,
  number: text(60),
  issue_date: isoDate,
  due_date: isoDate,
  delivery_date: isoDate,
  currency: text(10).transform((value) => {
    if (!value) {
      return null;
    }
    return /^(mad|dh|dhs|dirhams?)$/i.test(value) ? "MAD" : value.toUpperCase();
  }),
  amount_excl_tax: amount,
  vat_amount: amount,
  amount_incl_tax: amount,
});

/** Réponse JSON du modèle → facture proposée ; champs invalides ramenés à null un à un. */
export function parseAiInvoice(content: string): AiInvoice {
  let json: unknown;
  try {
    // Certains modèles entourent le JSON d'un bloc de code
    json = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AiReadingError("Réponse de l'IA illisible. Réessayez.");
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new AiReadingError("Réponse de l'IA illisible. Réessayez.");
  }
  const data = responseSchema.parse(json);
  let { amount_excl_tax: excl, vat_amount: vat, amount_incl_tax: incl } = data;
  // Total manquant déduit des deux autres
  if (incl === null && excl !== null && vat !== null) {
    incl = Math.round((excl + vat) * 100) / 100;
  } else if (excl === null && incl !== null && vat !== null && vat <= incl) {
    excl = Math.round((incl - vat) * 100) / 100;
  } else if (vat === null && incl !== null && excl !== null && excl <= incl) {
    vat = Math.round((incl - excl) * 100) / 100;
  }
  return {
    isInvoice: data.is_invoice,
    supplier: {
      name: data.supplier_name,
      ice: data.supplier_ice,
      taxId: data.supplier_tax_id,
      tradeRegister: data.supplier_trade_register,
      city: data.supplier_city,
    },
    customerIce: data.customer_ice,
    number: data.number,
    issueDate: data.issue_date,
    dueDate: data.due_date,
    deliveryDate: data.delivery_date,
    currency: data.currency,
    amountExclTax: excl,
    vatAmount: vat,
    amountInclTax: incl,
  };
}

/** Délai convenu déduit de l'échéance imprimée (0 à 365 jours). */
export function aiPaymentTermsDays(invoice: Pick<AiInvoice, "issueDate" | "dueDate">): number | null {
  if (!invoice.issueDate || !invoice.dueDate) {
    return null;
  }
  const days = daysBetween(invoice.issueDate, invoice.dueDate);
  return days >= 0 && days <= 365 ? days : null;
}
