import { z } from "zod";

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
