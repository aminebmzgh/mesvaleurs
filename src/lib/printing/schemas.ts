import { z } from "zod";
import { templateOptionsSchema, zoneSchema } from "./fields";

/** Modèle d'impression enregistré depuis l'éditeur. */
export const templateInputSchema = z.object({
  name: z.string().trim().min(1, { error: "Le nom du modèle est obligatoire." }).max(120),
  widthMm: z.number().min(50, { error: "Largeur trop faible." }).max(300, { error: "Largeur trop grande." }),
  heightMm: z.number().min(30, { error: "Hauteur trop faible." }).max(300, { error: "Hauteur trop grande." }),
  // Décalage imprimante : compense le placement propre à chaque imprimante
  offsetXMm: z.number().min(-30).max(30),
  offsetYMm: z.number().min(-30).max(30),
  zones: z.array(zoneSchema).max(40),
  options: templateOptionsSchema,
});

export type TemplateInput = z.infer<typeof templateInputSchema>;

/** Fonds de formule acceptés (scan ou photo à plat). */
export const BACKGROUND_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const BACKGROUND_MAX_BYTES = 10 * 1024 * 1024;

/** Chemin du scan de fond : `<organisation>/<modèle>/<fichier>`. */
export function backgroundPath(organizationId: string, templateId: string, mimeType: string, unique: string) {
  return `${organizationId}/${templateId}/${unique}.${mimeType === "image/png" ? "png" : "jpg"}`;
}

export function isBackgroundPathOf(path: string, organizationId: string, templateId: string) {
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9-]+\.(jpg|png)$/.test(path) && path.startsWith(`${organizationId}/${templateId}/`);
}
