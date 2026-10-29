import { z } from "zod";
import { amountSchema } from "@/lib/validation";

export const LETTER_KINDS = ["cover_letter", "opposition", "postponement_request", "statement_request", "reminder"] as const;

/** Modèle de lettre de l'entreprise, saisi dans les paramètres. */
export const letterTemplateSchema = z.object({
  name: z.string().trim().min(1, { error: "Le nom du modèle est obligatoire." }).max(80),
  subject: z.string().trim().min(1, { error: "L'objet est obligatoire." }).max(200),
  body: z.string().trim().min(1, { error: "Le corps de la lettre est obligatoire." }).max(4000),
  closing: z.string().trim().max(2000),
});

export type LetterTemplateInput = z.infer<typeof letterTemplateSchema>;

/** Lettre de relance d'un client (saisie libre). */
export const reminderSchema = z.object({
  customer: z.string().trim().min(1, { error: "Le nom du client est obligatoire." }).max(200),
  address: z.string().trim().max(300).default(""),
  invoices: z.string().trim().min(1, { error: "Indiquez les factures concernées." }).max(200),
  amount: amountSchema("Le montant dû").refine((value) => value > 0, { error: "Le montant dû doit être positif." }),
  deadline: z.iso.date({ error: "Date limite invalide." }),
});
