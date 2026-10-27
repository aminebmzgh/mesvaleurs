import { z } from "zod";
import { columnMappingSchema } from "./parse";

/** Nombre maximal de lignes par import (au-delà : découper le relevé). */
export const MAX_STATEMENT_LINES = 5000;

/** Fichiers de relevé acceptés (bucket `releves`). */
export const STATEMENT_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export const STATEMENT_MAX_BYTES = 20 * 1024 * 1024;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const amount = z.number().positive().max(999_999_999_999.99).nullable();

export const parsedLineSchema = z
  .object({
    operationDate: isoDate,
    valueDate: isoDate.nullable(),
    label: z.string().trim().min(1).max(500),
    reference: z.string().max(120).nullable(),
    debit: amount,
    credit: amount,
  })
  .refine((line) => (line.debit === null) !== (line.credit === null), {
    error: "Chaque ligne a soit un débit, soit un crédit.",
  });

export const importRequestSchema = z.object({
  bankAccountId: z.uuid({ error: "Choisissez le compte bancaire." }),
  format: z.enum(["csv", "excel"]),
  /** Empreinte SHA-256 du fichier, calculée dans le navigateur : détecte un relevé déjà importé. */
  fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  filePath: z.string().max(300).nullable(),
  headerSignature: z.string().max(2000),
  mapping: columnMappingSchema,
  lines: z
    .array(parsedLineSchema)
    .min(1, { error: "Aucune ligne de mouvement à importer." })
    .max(MAX_STATEMENT_LINES, { error: `${MAX_STATEMENT_LINES} lignes au maximum par import : découpez le relevé.` }),
});

export type ImportRequest = z.infer<typeof importRequestSchema>;

/** Chemin du fichier d'origine : `<organisation>/<compte>/<fichier>`. */
export function statementFilePath(organizationId: string, bankAccountId: string, fileName: string, unique: string) {
  const extension = (fileName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  return `${organizationId}/${bankAccountId}/${unique}${extension ? `.${extension}` : ""}`;
}

export function isStatementPathOf(path: string, organizationId: string, bankAccountId: string) {
  return /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9-]+(\.[a-z0-9]+)?$/.test(path) && path.startsWith(`${organizationId}/${bankAccountId}/`);
}
