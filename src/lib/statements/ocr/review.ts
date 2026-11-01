/**
 * Vérification obligatoire d'un relevé lu par OCR : chaque mouvement devient une ligne
 * modifiable (date, libellé, débit, crédit), les lectures incertaines sont signalées,
 * puis les lignes corrigées sont relues avant l'import.
 */
import { formatAmount } from "@/lib/format";
import { type Cell, type ColumnMapping, type ParsedLine, parseStatementAmount, parseStatementDate } from "../parse";

export type ReviewField = "operationDate" | "label" | "debit" | "credit";

export type ReviewLine = {
  id: string;
  /** AAAA-MM-JJ, vide si illisible. */
  operationDate: string;
  valueDate: string | null;
  label: string;
  reference: string | null;
  /** Montants tels que saisis (« 1 234,56 »). */
  debit: string;
  credit: string;
  /** Champs dont la lecture est incertaine ou impossible : à vérifier en priorité. */
  doubtful: ReviewField[];
};

const text = (cell: Cell) => (cell === null || cell === undefined ? "" : String(cell).replace(/\s+/g, " ").trim());
const amountText = (value: number | null) => (value === null || value === 0 ? "" : formatAmount(Math.abs(value)));

/**
 * Lignes à vérifier : une par ligne datée du tableau (les soldes et totaux, sans date,
 * sont écartés comme pour un export Excel). Les montants illisibles restent à saisir.
 */
export function reviewLines(rows: Cell[][], headerRow: number, mapping: ColumnMapping, uncertain: Set<string>): ReviewLine[] {
  const lines: ReviewLine[] = [];
  const at = (row: Cell[], column: number | null) => (column === null ? undefined : row[column]);
  const isUncertain = (index: number, column: number | null) => column !== null && uncertain.has(`${index}:${column}`);

  rows.forEach((row, index) => {
    if (index <= headerRow) {
      return;
    }
    const dateColumn = mapping.operationDate ?? mapping.valueDate;
    const operationDate = parseStatementDate(at(row, dateColumn));
    if (!operationDate) {
      return;
    }
    let debit = "";
    let credit = "";
    const doubtful: ReviewField[] = [];
    if (mapping.amount !== null) {
      const raw = at(row, mapping.amount);
      const amount = parseStatementAmount(raw);
      if (amount === null) {
        debit = text(raw);
        doubtful.push("debit", "credit");
      } else {
        debit = amount < 0 ? amountText(amount) : "";
        credit = amount > 0 ? amountText(amount) : "";
        if (isUncertain(index, mapping.amount)) {
          doubtful.push(amount < 0 ? "debit" : "credit");
        }
      }
    } else {
      for (const field of ["debit", "credit"] as const) {
        const raw = at(row, mapping[field]);
        const amount = parseStatementAmount(raw);
        const value = amount === null ? text(raw) : amountText(amount);
        if (field === "debit") {
          debit = value;
        } else {
          credit = value;
        }
        if ((value !== "" && amount === null) || (value !== "" && isUncertain(index, mapping[field]))) {
          doubtful.push(field);
        }
      }
      if (debit === "" && credit === "") {
        doubtful.push("debit", "credit");
      }
    }
    const label = text(at(row, mapping.label));
    if (isUncertain(index, dateColumn)) {
      doubtful.push("operationDate");
    }
    if (label === "" || isUncertain(index, mapping.label)) {
      doubtful.push("label");
    }
    lines.push({
      id: `l${index}`,
      operationDate,
      valueDate: parseStatementDate(at(row, mapping.valueDate)),
      label,
      reference: text(at(row, mapping.reference)).slice(0, 120) || null,
      debit,
      credit,
      doubtful,
    });
  });
  return lines;
}

export function emptyReviewLine(id: string, operationDate = ""): ReviewLine {
  return { id, operationDate, valueDate: null, label: "", reference: null, debit: "", credit: "", doubtful: [] };
}

export type ReviewResult = { lines: ParsedLine[]; errors: Map<string, string> };

/** Relit les lignes corrigées : chaque ligne a une date, un libellé et soit un débit, soit un crédit. */
export function parseReviewLines(lines: ReviewLine[]): ReviewResult {
  const parsed: ParsedLine[] = [];
  const errors = new Map<string, string>();
  for (const line of lines) {
    const operationDate = parseStatementDate(line.operationDate);
    const debit = line.debit.trim() === "" ? null : parseStatementAmount(line.debit);
    const credit = line.credit.trim() === "" ? null : parseStatementAmount(line.credit);
    const label = line.label.replace(/\s+/g, " ").trim();
    if (!operationDate) {
      errors.set(line.id, "Date manquante ou invalide.");
    } else if (!label) {
      errors.set(line.id, "Libellé manquant.");
    } else if ((line.debit.trim() !== "" && (debit === null || debit <= 0)) || (line.credit.trim() !== "" && (credit === null || credit <= 0))) {
      errors.set(line.id, "Montant illisible : saisissez-le, par exemple 1 234,56.");
    } else if ((debit === null) === (credit === null)) {
      errors.set(line.id, "Saisissez soit un débit, soit un crédit.");
    } else {
      parsed.push({ operationDate, valueDate: line.valueDate, label: label.slice(0, 500), reference: line.reference, debit, credit });
    }
  }
  return { lines: parsed, errors };
}
