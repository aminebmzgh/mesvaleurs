import { z } from "zod";
import { parseAmount } from "./amount";
import { isValidRib, normalizeRib } from "./rib";

/** Schémas Zod partagés entre formulaires et Server Actions, messages en français. */

export const emailSchema = z
  .string({ error: "L'adresse e-mail est obligatoire." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Adresse e-mail invalide." }));

export const passwordSchema = z
  .string({ error: "Le mot de passe est obligatoire." })
  .min(8, { error: "Le mot de passe doit contenir au moins 8 caractères." })
  .max(72, { error: "Le mot de passe ne doit pas dépasser 72 caractères." })
  .regex(/[A-Za-z]/, { error: "Le mot de passe doit contenir au moins une lettre." })
  .regex(/\d/, { error: "Le mot de passe doit contenir au moins un chiffre." });

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .min(1, { error: `${label} est obligatoire.` })
    .max(max, { error: `${label} ne doit pas dépasser ${max} caractères.` });

export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, { error: `Ce champ ne doit pas dépasser ${max} caractères.` })
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

/** ICE (Identifiant commun de l'entreprise) : 15 chiffres. */
export const iceSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, ""))
  .refine((value) => value === "" || /^\d{15}$/.test(value), {
    error: "L'ICE doit comporter 15 chiffres.",
  })
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

/** RIB marocain : 24 chiffres avec clé valide (espaces et tirets ignorés). Vide → null. */
export const ribSchema = z
  .string()
  .trim()
  .transform((value) => normalizeRib(value))
  .refine((value) => value === "" || /^\d{24}$/.test(value), {
    error: "Le RIB doit comporter 24 chiffres.",
  })
  .refine((value) => value === "" || isValidRib(value), {
    error: "Clé RIB invalide : vérifiez les chiffres saisis.",
  })
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

/** Montant saisi au format marocain (« 1 234,56 »), converti en nombre. */
export const amountSchema = (label: string, { allowNegative = false, required = true } = {}) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .refine((value) => !required || value !== "", { error: `${label} est obligatoire.` })
    .refine((value) => value === "" || parseAmount(value, { allowNegative }) !== null, {
      error: `${label} : montant invalide (exemple : 1 234,56).`,
    })
    .transform((value) => (value === "" ? 0 : (parseAmount(value, { allowNegative }) as number)));

/** Nombre entier positif saisi (numéros de chèques, quantités). */
export const integerSchema = (label: string, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .regex(/^\d+$/, { error: `${label} doit être un nombre entier.` })
    .transform(Number)
    .refine((value) => value >= min && value <= max, {
      error: `${label} doit être compris entre ${min} et ${max}.`,
    });

/** Date au format ISO (champ <input type="date">). Vide → null. */
export const optionalDateSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), { error: "Date invalide." })
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

/** Montant facultatif : vide → null, sinon montant positif au format marocain. */
export const optionalAmountSchema = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || parseAmount(value) !== null, {
      error: `${label} : montant invalide (exemple : 1 234,56).`,
    })
    .transform((value) => (value === "" ? null : (parseAmount(value) as number)))
    .optional();

/** Date obligatoire au format ISO (champ <input type="date">). */
export const dateSchema = (label: string) =>
  z
    .string({ error: `${label} est obligatoire.` })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: `${label} est obligatoire.` });
