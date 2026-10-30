import { z } from "zod";
import {
  accountingCodeSchema,
  amountSchema,
  integerSchema,
  optionalDateSchema,
  optionalText,
  requiredText,
  ribSchema,
} from "@/lib/validation";

/** Nombre maximal de formules par carnet : protège contre une faute de frappe. */
export const MAX_CHECKBOOK_SIZE = 1000;

export const bankAccountSchema = z.object({
  bank_id: z.uuid({ error: "Choisissez une banque." }),
  label: requiredText("Le libellé", 120),
  branch: optionalText(120),
  rib: ribSchema,
  opening_balance: amountSchema("Le solde d'ouverture", { allowNegative: true }),
  opening_balance_date: optionalDateSchema,
  accounting_code: accountingCodeSchema,
});

export const checkbookSchema = z
  .object({
    type: z.enum(["check", "lcn"], { error: "Choisissez le type de carnet." }),
    first_number: integerSchema("Le premier numéro"),
    last_number: integerSchema("Le dernier numéro"),
    received_at: optionalDateSchema,
  })
  .refine((data) => data.last_number >= data.first_number, {
    error: "Le dernier numéro doit être supérieur ou égal au premier.",
    path: ["last_number"],
  })
  .refine((data) => data.last_number - data.first_number + 1 <= MAX_CHECKBOOK_SIZE, {
    error: `Un carnet ne peut pas dépasser ${MAX_CHECKBOOK_SIZE} formules.`,
    path: ["last_number"],
  });

/**
 * Nombre de chiffres imprimés sur les formules, déduit de la saisie avec ses
 * zéros initiaux (« 0001000 » → 7), borné entre 1 et 12.
 */
export function numberWidthFromInput(first: string, last: string): number {
  return Math.min(Math.max(first.trim().length, last.trim().length, 1), 12);
}
