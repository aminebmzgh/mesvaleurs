/**
 * Analyseurs de relevés PDF, un par format de banque, avec un analyseur générique
 * de secours. Chaque analyseur reconnaît son format dans le texte du document et
 * produit un tableau (en-tête puis lignes) repris ensuite par l'assistant de
 * correspondance des colonnes, comme un export Excel ou CSV.
 */
import type { Cell } from "../parse";
import { groupLines, type PdfLine, type PdfTextItem, tableFromLines } from "./layout";

export type PdfStatementParser = {
  id: string;
  /** Nom affiché : banque et format reconnus. */
  name: string;
  /** Le document est-il dans ce format ? (texte complet, une ligne par ligne de texte) */
  detect: (text: string) => boolean;
  /** Tableau du relevé, ou null si le document ne peut pas être lu. */
  parse: (lines: PdfLine[]) => Cell[][] | null;
};

/** Analyseur générique : colonnes déduites de la position de l'en-tête. */
export const GENERIC_PDF_PARSER: PdfStatementParser = {
  id: "generic",
  name: "Lecture générique",
  detect: () => true,
  parse: tableFromLines,
};

/**
 * Analyseurs dédiés, essayés avant l'analyseur générique. Un analyseur s'ajoute ici
 * à partir de relevés réels de la banque, lorsque la lecture générique ne suffit pas.
 */
export const BANK_PDF_PARSERS: PdfStatementParser[] = [];

export type PdfStatement = { rows: Cell[][]; parser: Pick<PdfStatementParser, "id" | "name"> };

/** Texte moyen par page en deçà duquel le PDF est considéré comme scanné. */
const MIN_TEXT_PER_PAGE = 20;

export class PdfStatementError extends Error {
  constructor(
    readonly reason: "scanned" | "unreadable",
    message: string,
  ) {
    super(message);
  }
}

/** Lit un relevé PDF à partir de son texte positionné. */
export function parsePdfStatement(items: PdfTextItem[], pageCount: number, parsers = BANK_PDF_PARSERS): PdfStatement {
  const characters = items.reduce((sum, item) => sum + item.text.trim().length, 0);
  if (characters < MIN_TEXT_PER_PAGE * Math.max(pageCount, 1)) {
    throw new PdfStatementError(
      "scanned",
      "Ce PDF ne contient pas de texte : c'est sans doute un scan. Téléchargez le relevé au format PDF, Excel ou CSV depuis votre banque en ligne.",
    );
  }
  const lines = groupLines(items);
  const text = lines.map((line) => line.segments.map((segment) => segment.text).join(" ")).join("\n");
  for (const parser of [...parsers.filter((candidate) => candidate.detect(text)), GENERIC_PDF_PARSER]) {
    const rows = parser.parse(lines);
    if (rows && rows.length > 1) {
      return { rows, parser: { id: parser.id, name: parser.name } };
    }
  }
  throw new PdfStatementError(
    "unreadable",
    "Les colonnes de ce relevé PDF n'ont pas été reconnues (date, libellé, débit, crédit). Exportez-le en Excel ou en CSV depuis votre banque en ligne.",
  );
}
