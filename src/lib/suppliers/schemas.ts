import { z } from "zod";
import { accountingCodeSchema, emailSchema, iceSchema, optionalText, requiredText, ribSchema } from "@/lib/validation";

export const supplierSchema = z.object({
  name: requiredText("La raison sociale"),
  // Nom imprimé sur les chèques et LCN ; à défaut, la raison sociale
  payee_name: optionalText(200),
  ice: iceSchema,
  tax_id: optionalText(30),
  trade_register: optionalText(60),
  rib: ribSchema,
  address: optionalText(300),
  city: optionalText(120),
  contact_name: optionalText(120),
  email: z.union([z.literal("").transform(() => null), emailSchema]).optional(),
  phone: optionalText(30),
  payment_terms_days: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d+$/.test(value) && Number(value) <= 365), {
      error: "Le délai doit être un nombre de jours entre 0 et 365.",
    })
    .transform((value) => (value === "" ? null : Number(value)))
    .optional(),
  // Case à cocher : présente uniquement si cochée
  print_cover_letter: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
  notes: optionalText(2000),
  // Compte auxiliaire de l'export comptable
  accounting_code: accountingCodeSchema,
});

export type SupplierInput = z.infer<typeof supplierSchema>;

/**
 * Recherche saisie par l'utilisateur, nettoyée pour un filtre PostgREST `ilike` :
 * les caractères de syntaxe du filtre (virgule, parenthèses, jokers) sont retirés.
 */
export function sanitizeSearch(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/[,()%*\\:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
