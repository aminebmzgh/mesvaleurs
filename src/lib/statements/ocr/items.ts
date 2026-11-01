/**
 * Relevés scannés : du résultat de Tesseract (mots positionnés) au tableau du relevé,
 * par la même reconstitution que les PDF « texte ». Fonctions pures, testées sans OCR.
 */
import { buildTable, groupLines, type PdfTextItem, type StatementTable } from "../pdf/layout";
import { PdfStatementError } from "../pdf/parsers";

type OcrBox = { x0: number; y0: number; x1: number; y1: number };
export type OcrWord = { text: string; confidence: number; bbox: OcrBox };
export type OcrLine = { bbox: OcrBox; baseline?: OcrBox & { has_baseline?: boolean }; words: OcrWord[] };
export type OcrBlock = { paragraphs: { lines: OcrLine[] }[] };

/** Largeur d'une page A4 en points : les images sont ramenées à cette échelle, comme un PDF. */
export const PAGE_WIDTH_POINTS = 595;

/**
 * Mots d'une page reconnue, en points depuis le coin supérieur gauche. Les mots d'une
 * même ligne Tesseract partagent la hauteur de sa ligne de base : une page légèrement
 * de travers reste lue ligne par ligne.
 */
export function itemsFromOcr(blocks: OcrBlock[] | null, page: number, imageWidth: number): PdfTextItem[] {
  const unit = PAGE_WIDTH_POINTS / imageWidth;
  const items: PdfTextItem[] = [];
  for (const line of (blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))) {
    const baseline = line.baseline && line.baseline.has_baseline !== false ? (line.baseline.y0 + line.baseline.y1) / 2 : line.bbox.y1;
    for (const word of line.words) {
      const text = word.text.trim();
      if (text === "") {
        continue;
      }
      items.push({
        text,
        x: word.bbox.x0 * unit,
        y: baseline * unit,
        width: (word.bbox.x1 - word.bbox.x0) * unit,
        height: (word.bbox.y1 - word.bbox.y0) * unit,
        page,
        confidence: word.confidence,
      });
    }
  }
  return items;
}

/** Tableau d'un relevé scanné, avec les cellules à vérifier. */
export function tableFromOcr(items: PdfTextItem[]): StatementTable {
  if (items.length === 0) {
    throw new PdfStatementError(
      "unreadable",
      "Aucun texte lisible sur ce scan. Numérisez le relevé à plat, bien éclairé et net (300 ppp), ou téléchargez-le en PDF ou Excel depuis votre banque en ligne.",
    );
  }
  const table = buildTable(groupLines(items));
  if (!table || table.rows.length < 2) {
    throw new PdfStatementError(
      "unreadable",
      "Les colonnes du relevé (date, libellé, débit, crédit) n'ont pas été reconnues sur ce scan. Vérifiez que l'en-tête du tableau est visible et lisible.",
    );
  }
  return table;
}
