import type { z } from "zod";

/** État renvoyé par une Server Action de formulaire (utilisé avec useActionState). */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialFormState: FormState = {};

/** Erreurs de validation Zod, regroupées par champ. */
export function toFieldErrors(error: z.ZodError): FormState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}
