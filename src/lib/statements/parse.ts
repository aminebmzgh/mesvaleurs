/**
 * Lecture des relevés bancaires exportés en Excel ou CSV : détection de la ligne
 * d'en-tête, correspondance des colonnes, dates et montants au format marocain.
 * Fonctions pures, utilisées dans le navigateur (aperçu) et sur le serveur (contrôle).
 */
import { z } from "zod";
import { normalizeLabel } from "./extract";

export type Cell = string | number | boolean | Date | null | undefined;

export const MAPPING_KEYS = ["operationDate", "valueDate", "label", "reference", "debit", "credit", "amount"] as const;
export type MappingKey = (typeof MAPPING_KEYS)[number];

export const MAPPING_LABELS: Record<MappingKey, string> = {
  operationDate: "Date d'opération",
  valueDate: "Date de valeur",
  label: "Libellé",
  reference: "Référence",
  debit: "Débit",
  credit: "Crédit",
  amount: "Montant signé (débit négatif)",
};

/** Index de colonne pour chaque information (null : absente du relevé). */
export const columnMappingSchema = z.object({
  operationDate: z.number().int().min(0).nullable(),
  valueDate: z.number().int().min(0).nullable(),
  label: z.number().int().min(0).nullable(),
  reference: z.number().int().min(0).nullable(),
  debit: z.number().int().min(0).nullable(),
  credit: z.number().int().min(0).nullable(),
  amount: z.number().int().min(0).nullable(),
});
export type ColumnMapping = z.infer<typeof columnMappingSchema>;

export type ParsedLine = {
  operationDate: string;
  valueDate: string | null;
  label: string;
  reference: string | null;
  debit: number | null;
  credit: number | null;
};

const KEYWORDS: Record<MappingKey, RegExp> = {
  operationDate: /^(DATE( D.?OPERATION| OPE(RATION)?| OP\.?| COMPTABLE)?|DATE OPER)$/,
  valueDate: /^DATE( DE)? VAL(EUR)?\.?$|^VALEUR$/,
  label: /LIBELLE|DESIGNATION|DESCRIPTION|NATURE|OPERATION$|^MOTIF/,
  reference: /^REF(ERENCE)?\.?$|N° ?PIECE|PIECE/,
  debit: /^DEBIT|^RETRAIT|^SORTIE/,
  credit: /^CREDIT|^VERSEMENT|^ENTREE/,
  amount: /^MONTANT|^SOMME/,
};

const text = (cell: Cell) => (cell === null || cell === undefined ? "" : String(cell).trim());

/** Ligne d'en-tête probable : au moins deux libellés connus, dont une date. */
export function isHeaderRow(row: Cell[]): boolean {
  const labels = row.map((cell) => normalizeLabel(text(cell)));
  const hits = MAPPING_KEYS.filter((key) => labels.some((label) => KEYWORDS[key].test(label)));
  return hits.length >= 2 && hits.some((key) => key === "operationDate" || key === "valueDate");
}

/** Ligne d'en-tête : la première des 30 premières lignes qui contient au moins deux libellés connus. */
export function detectHeaderRow(rows: Cell[][]): number {
  const index = rows.slice(0, 30).findIndex(isHeaderRow);
  return Math.max(index, 0);
}

/** Correspondance proposée à partir des libellés d'en-tête. */
export function guessMapping(headers: Cell[]): ColumnMapping {
  const labels = headers.map((cell) => normalizeLabel(text(cell)));
  const used = new Set<number>();
  const find = (key: MappingKey) => {
    const index = labels.findIndex((label, i) => !used.has(i) && label !== "" && KEYWORDS[key].test(label));
    if (index >= 0) {
      used.add(index);
      return index;
    }
    return null;
  };
  // Ordre important : « Date de valeur » avant « Date », « Débit » et « Crédit » avant « Montant »
  const valueDate = find("valueDate");
  const operationDate = find("operationDate");
  const debit = find("debit");
  const credit = find("credit");
  const reference = find("reference");
  const label = find("label");
  const amount = debit === null && credit === null ? find("amount") : null;
  return { operationDate, valueDate, label, reference, debit, credit, amount };
}

/** Date d'un relevé → AAAA-MM-JJ. Accepte jj/mm/aaaa, jj-mm-aa, jj.mm.aaaa, ISO, date ou numéro de série Excel. */
export function parseStatementDate(cell: Cell): string | null {
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? null : isoFromParts(cell.getFullYear(), cell.getMonth() + 1, cell.getDate());
  }
  if (typeof cell === "number") {
    // Numéro de série Excel (jours depuis le 30/12/1899), plage plausible 2000 → 2100
    if (cell < 36526 || cell > 73051) {
      return null;
    }
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(cell) * 86_400_000);
    return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const value = text(cell);
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return isoFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return isoFromParts(year, Number(match[2]), Number(match[1]));
  }
  return null;
}

function isoFromParts(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Montant d'un relevé : nombre, « 1 234,56 », « 1.234,56 », « -1234.56 », « (123,45) »,
 * « 1 234,56- » ou « 1 234,56 DB ». Vide → null. Signe négatif conservé.
 */
export function parseStatementAmount(cell: Cell): number | null {
  if (typeof cell === "number") {
    return Number.isFinite(cell) ? Math.round(cell * 100) / 100 : null;
  }
  let value = text(cell).replace(/[\s\u00A0\u202F]/g, "").replace(/(DH|MAD)$/i, "");
  if (value === "" || value === "-") {
    return null;
  }
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (/(-|DB|D)$/i.test(value) && !/^-/.test(value)) {
    negative = true;
    value = value.replace(/(-|DB|D)$/i, "");
  }
  if (value.startsWith("-")) {
    negative = !negative;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }
  if (value.includes(",")) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if ((value.match(/\./g) ?? []).length > 1) {
    value = value.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,3})?$/.test(value)) {
    return null;
  }
  const amount = Math.round(Number(value) * 100) / 100;
  return negative ? -amount : amount;
}

export type ParseResult = {
  lines: ParsedLine[];
  /** Lignes ignorées faute de date (soldes, totaux, lignes vides). */
  skipped: number;
  errors: { row: number; message: string }[];
};

/** Applique la correspondance de colonnes aux lignes qui suivent l'en-tête. */
export function parseRows(rows: Cell[][], headerRow: number, mapping: ColumnMapping): ParseResult {
  const lines: ParsedLine[] = [];
  const errors: ParseResult["errors"] = [];
  let skipped = 0;
  const at = (row: Cell[], index: number | null) => (index === null ? undefined : row[index]);

  rows.slice(headerRow + 1).forEach((row, offset) => {
    const rowNumber = headerRow + offset + 2; // numéro de ligne affiché à l'utilisateur (base 1)
    const operationDate = parseStatementDate(at(row, mapping.operationDate) ?? at(row, mapping.valueDate));
    if (!operationDate) {
      skipped += 1;
      return;
    }
    const label = text(at(row, mapping.label));
    let debit: number | null = null;
    let credit: number | null = null;
    if (mapping.amount !== null) {
      const amount = parseStatementAmount(at(row, mapping.amount));
      if (amount !== null) {
        debit = amount < 0 ? -amount : null;
        credit = amount > 0 ? amount : null;
      }
    } else {
      const rawDebit = parseStatementAmount(at(row, mapping.debit));
      const rawCredit = parseStatementAmount(at(row, mapping.credit));
      debit = rawDebit !== null && rawDebit !== 0 ? Math.abs(rawDebit) : null;
      credit = rawCredit !== null && rawCredit !== 0 ? Math.abs(rawCredit) : null;
    }
    if (debit === null && credit === null) {
      errors.push({ row: rowNumber, message: "Montant illisible ou absent." });
      return;
    }
    if (debit !== null && credit !== null) {
      errors.push({ row: rowNumber, message: "Débit et crédit renseignés sur la même ligne." });
      return;
    }
    if (!label) {
      errors.push({ row: rowNumber, message: "Libellé absent." });
      return;
    }
    lines.push({
      operationDate,
      valueDate: parseStatementDate(at(row, mapping.valueDate)),
      label: label.slice(0, 500),
      reference: text(at(row, mapping.reference)).slice(0, 120) || null,
      debit,
      credit,
    });
  });
  return { lines, skipped, errors };
}

/**
 * Clé d'une ligne pour la détection des doublons entre imports : date, montant et
 * libellé normalisé, plus le rang de la ligne parmi ses identiques (deux frais
 * bancaires identiques le même jour restent deux lignes).
 */
export function lineKeys(lines: ParsedLine[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const base = [line.operationDate, line.debit ?? "", line.credit ?? "", normalizeLabel(line.label)].join("|");
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return `${base}|${occurrence}`;
  });
}

/** Période couverte par les lignes. */
export function statementPeriod(lines: ParsedLine[]): { start: string; end: string } | null {
  if (lines.length === 0) {
    return null;
  }
  const dates = lines.map((line) => line.operationDate).sort();
  return { start: dates[0], end: dates.at(-1)! };
}
