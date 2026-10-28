import { z } from "zod";

/** Modèle de lettre de l'entreprise, saisi dans les paramètres. */
export const letterTemplateSchema = z.object({
  name: z.string().trim().min(1, { error: "Le nom du modèle est obligatoire." }).max(80),
  subject: z.string().trim().min(1, { error: "L'objet est obligatoire." }).max(200),
  body: z.string().trim().min(1, { error: "Le corps de la lettre est obligatoire." }).max(4000),
  closing: z.string().trim().max(2000),
});

export type LetterTemplateInput = z.infer<typeof letterTemplateSchema>;
