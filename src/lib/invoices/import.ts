/**
 * Import de factures depuis Excel ou CSV (logiciel de gestion, tableur…).
 * Lecture et contrôles purs, partagés entre l'aperçu (navigateur) et le serveur.
 */
import { z } from "zod";
import { toCents } from "@/lib/amount";
import { normalizeLabel } from "@/lib/statements/extract";
import { type Cell, parseStatementAmount, parseStatementDate } from "@/lib/statements/parse";

export const INVOICE_MAPPING_KEYS = [
  "supplierName",
  "supplierIce",
  "number",
  "issueDate",
  "amountExclTax",
  "vatAmount",
  "amountInclTax",
  "paymentTermsDays",
] as const;
export type InvoiceMappingKey = (typeof INVOICE_MAPPING_KEYS)[number];

export const INVOICE_MAPPING_LABELS: Record<InvoiceMappingKey, string> = {
  supplierName: "Fournisseur (raison sociale)",
  supplierIce: "ICE du fournisseur",
  number: "Numéro de facture",
  issueDate: "Date de facture",
  amountExclTax: "Montant HT",
  vatAmount: "TVA",
  amountInclTax: "Montant TTC",
  paymentTermsDays: "Délai de paiement (jours)",
};

export type InvoiceMapping = Record<InvoiceMappingKey, number | null>;

const KEYWORDS: Record<InvoiceMappingKey, RegExp> = {
  supplierName: /FOURNISSEUR|RAISON SOCIALE|TIERS|SOCIETE/,
  supplierIce: /^ICE\b|IDENTIFIANT COMMUN/,
  number: /N° ?(DE )?FACT|NUMERO|^FACTURE$|^REF(ERENCE)?\.?( FACTURE)?$|^N°$/,
  issueDate: /^DATE( (DE )?(LA )?FACTURE)?$|^DATE FACT/,
  amountExclTax: /\bHT\b|HORS TAXE/,
  vatAmount: /^TVA|MONTANT TVA/,
  amountInclTax: /\bTTC\b|TOUTES TAXES|^MONTANT$|NET A PAYER/,
  paymentTermsDays: /DELAI|ECHEANCE \(JOURS\)/,
};

const text = (cell: Cell) => (cell === null || cell === undefined ? "" : String(cell).trim());

export function detectInvoiceHeaderRow(rows: Cell[][]): number {
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const labels = rows[index].map((cell) => normalizeLabel(text(cell)));
    const hits = INVOICE_MAPPING_KEYS.filter((key) => labels.some((label) => KEYWORDS[key].test(label)));
    if (hits.length >= 3) {
      return index;
    }
  }
  return 0;
}

export function guessInvoiceMapping(headers: Cell[]): InvoiceMapping {
  const labels = headers.map((cell) => normalizeLabel(text(cell)));
  const used = new Set<number>();
  const mapping = Object.fromEntries(INVOICE_MAPPING_KEYS.map((key) => [key, null])) as InvoiceMapping;
  // Ordre : ICE avant raison sociale, HT et TVA avant TTC (« Montant » seul = TTC)
  for (const key of ["supplierIce", "supplierName", "number", "issueDate", "amountExclTax", "vatAmount", "amountInclTax", "paymentTermsDays"] as const) {
    const index = labels.findIndex((label, i) => !used.has(i) && label !== "" && KEYWORDS[key].test(label));
    if (index >= 0) {
      used.add(index);
      mapping[key] = index;
    }
  }
  return mapping;
}

export const invoiceImportRowSchema = z.object({
  line: z.number().int().positive(),
  supplierName: z.string().trim().max(200),
  supplierIce: z.string().regex(/^\d{15}$/).nullable(),
  number: z.string().trim().min(1).max(60),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountExclTax: z.number().nonnegative().nullable(),
  vatAmount: z.number().nonnegative().nullable(),
  amountInclTax: z.number().positive(),
  paymentTermsDays: z.number().int().min(0).max(365).nullable(),
});
export type InvoiceImportRow = z.infer<typeof invoiceImportRowSchema>;

export type InvoiceParseResult = { rows: InvoiceImportRow[]; errors: { line: number; message: string }[] };

/** Lit et contrôle chaque facture ; les doublons à l'intérieur du fichier sont signalés. */
export function parseInvoiceRows(rows: Cell[][], headerRow: number, mapping: InvoiceMapping): InvoiceParseResult {
  const result: InvoiceParseResult = { rows: [], errors: [] };
  const seen = new Set<string>();
  const at = (row: Cell[], key: InvoiceMappingKey) => (mapping[key] === null ? undefined : row[mapping[key]!]);

  rows.slice(headerRow + 1).forEach((row, offset) => {
    const line = headerRow + offset + 2;
    if (row.every((cell) => text(cell) === "")) {
      return;
    }
    const error = (message: string) => result.errors.push({ line, message });

    const supplierName = text(at(row, "supplierName"));
    const iceText = text(at(row, "supplierIce")).replace(/\s/g, "");
    const supplierIce = /^\d{15}$/.test(iceText) ? iceText : null;
    if (!supplierName && !supplierIce) {
      return error("Fournisseur absent (raison sociale ou ICE).");
    }
    if (iceText && !supplierIce) {
      return error("ICE invalide : 15 chiffres attendus.");
    }
    const number = text(at(row, "number"));
    if (!number) {
      return error("Numéro de facture absent.");
    }
    const issueDate = parseStatementDate(at(row, "issueDate"));
    if (!issueDate) {
      return error("Date de facture absente ou illisible.");
    }

    const ht = parseStatementAmount(at(row, "amountExclTax"));
    const vat = parseStatementAmount(at(row, "vatAmount"));
    let ttc = parseStatementAmount(at(row, "amountInclTax"));
    if ((ht !== null && ht < 0) || (vat !== null && vat < 0) || (ttc !== null && ttc < 0)) {
      return error("Montant négatif : saisissez les avoirs à part.");
    }
    if (ttc === null && ht !== null && vat !== null) {
      ttc = (toCents(ht) + toCents(vat)) / 100;
    }
    if (ttc === null || ttc <= 0) {
      return error("Montant TTC absent ou nul.");
    }
    if (ht !== null && vat !== null && toCents(ht) + toCents(vat) !== toCents(ttc)) {
      return error("HT + TVA différent du TTC.");
    }

    const termsText = text(at(row, "paymentTermsDays"));
    const paymentTermsDays = /^\d{1,3}$/.test(termsText) && Number(termsText) <= 365 ? Number(termsText) : null;
    if (termsText && paymentTermsDays === null) {
      return error("Délai de paiement invalide (0 à 365 jours).");
    }

    const key = `${supplierIce ?? normalizeLabel(supplierName)}|${normalizeLabel(number)}`;
    if (seen.has(key)) {
      return error("Facture en double dans le fichier.");
    }
    seen.add(key);

    result.rows.push({
      line,
      supplierName,
      supplierIce,
      number,
      issueDate,
      amountExclTax: ht,
      vatAmount: vat,
      amountInclTax: ttc,
      paymentTermsDays,
    });
  });
  return result;
}

/** Clé de rapprochement d'un fournisseur par son nom (casse, accents et formes juridiques ignorés). */
export function supplierNameKey(name: string): string {
  return normalizeLabel(name)
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(SARL|SA|SAS|SARLAU|SNC|STE|STE\.|SOCIETE|AU)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
