/**
 * Reconstitution du tableau d'un relevé PDF « texte » à partir de la position des
 * morceaux de texte : regroupement en lignes, puis en cellules d'après les colonnes
 * de l'en-tête. Fonctions pures (pas de pdf.js ici), testées sans fichier.
 */
import { normalizeLabel } from "../extract";
import { type Cell, guessMapping, isHeaderRow, parseStatementAmount, parseStatementDate } from "../parse";

/**
 * Morceau de texte d'une page, coordonnées en points depuis le coin supérieur gauche.
 * Lecture OCR : confiance de la reconnaissance (0 à 100).
 */
export type PdfTextItem = { text: string; x: number; y: number; width: number; height: number; page: number; confidence?: number };
/** Suite de morceaux proches sur une même ligne : une cellule candidate (confiance : la plus faible). */
export type PdfSegment = { text: string; x0: number; x1: number; confidence?: number };
export type PdfLine = { page: number; y: number; segments: PdfSegment[] };

/** Regroupe les morceaux de texte en lignes (même page, même hauteur), puis en segments. */
export function groupLines(items: PdfTextItem[], yTolerance = 2.5): PdfLine[] {
  const sorted = items.filter((item) => item.text.trim() !== "").sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const groups: { page: number; y: number; items: PdfTextItem[] }[] = [];
  for (const item of sorted) {
    const current = groups.at(-1);
    if (current && current.page === item.page && Math.abs(item.y - current.y) <= yTolerance) {
      current.items.push(item);
    } else {
      groups.push({ page: item.page, y: item.y, items: [item] });
    }
  }
  return groups.map((group) => ({ page: group.page, y: group.y, segments: segmentsOf(group.items.sort((a, b) => a.x - b.x)) }));
}

function segmentsOf(items: PdfTextItem[]): PdfSegment[] {
  const segments: (PdfSegment & { raw: string })[] = [];
  for (const item of items) {
    const previous = segments.at(-1);
    const gap = previous ? item.x - previous.x1 : Infinity;
    // Au-delà d'un écart de l'ordre d'une espace large : nouvelle colonne
    if (previous && gap <= Math.max(4, item.height * 0.8)) {
      const space = gap > 1 || /\s$/.test(previous.raw) || /^\s/.test(item.text) ? " " : "";
      previous.raw += space + item.text;
      previous.x1 = Math.max(previous.x1, item.x + item.width);
      if (item.confidence !== undefined) {
        previous.confidence = Math.min(previous.confidence ?? 100, item.confidence);
      }
    } else {
      segments.push({ raw: item.text, text: "", x0: item.x, x1: item.x + item.width, confidence: item.confidence });
    }
  }
  return segments.map(({ raw, x0, x1, confidence }) => ({
    text: raw.replace(/\s+/g, " ").trim(),
    x0,
    x1,
    ...(confidence === undefined ? {} : { confidence }),
  }));
}

/** Écart habituel entre deux lignes d'une même page (médiane), pour reconnaître les libellés sur deux lignes. */
function lineSpacing(lines: PdfLine[]): number {
  const gaps = lines
    .slice(1)
    .map((line, index) => (line.page === lines[index].page ? line.y - lines[index].y : 0))
    .filter((gap) => gap > 0 && gap < 40)
    .sort((a, b) => a - b);
  return gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 12;
}

/** Range chaque segment dans la colonne de l'en-tête qu'il recouvre le plus. */
function cellsOf(line: PdfLine, header: PdfSegment[], minConfidence: number): { cells: string[]; uncertain: boolean[] } {
  const bounds = header.map((column, index) => ({
    start: index === 0 ? -Infinity : (header[index - 1].x1 + column.x0) / 2,
    end: index === header.length - 1 ? Infinity : (column.x1 + header[index + 1].x0) / 2,
  }));
  const cells = header.map(() => "");
  const uncertain = header.map(() => false);
  for (const segment of line.segments) {
    let best = 0;
    let bestOverlap = -Infinity;
    bounds.forEach((bound, index) => {
      const overlap = Math.min(segment.x1, bound.end) - Math.max(segment.x0, bound.start);
      if (overlap > bestOverlap) {
        best = index;
        bestOverlap = overlap;
      }
    });
    cells[best] = cells[best] ? `${cells[best]} ${segment.text}` : segment.text;
    uncertain[best] ||= segment.confidence !== undefined && segment.confidence < minConfidence;
  }
  return { cells, uncertain };
}

const signatureOf = (texts: string[]) => texts.map(normalizeLabel).join("|");

/** Tableau d'un relevé, avec les cellules dont la lecture OCR est incertaine (clés « ligne:colonne »). */
export type StatementTable = { rows: Cell[][]; uncertain: Set<string> };

/** Confiance OCR en deçà de laquelle une cellule est signalée à vérifier. */
export const OCR_MIN_CONFIDENCE = 80;

export function tableFromLines(lines: PdfLine[]): Cell[][] | null {
  return buildTable(lines)?.rows ?? null;
}

/**
 * Tableau du relevé : la ligne d'en-tête (première ligne qui ressemble à un en-tête
 * de relevé), puis une ligne par ligne de texte. Les en-têtes répétés en haut de page
 * sont écartés, et la suite d'un libellé sur la ligne suivante est rattachée au
 * mouvement. Renvoie null si aucun en-tête n'est reconnu.
 */
export function buildTable(lines: PdfLine[], minConfidence = OCR_MIN_CONFIDENCE): StatementTable | null {
  const headerIndex = lines.findIndex((line) => isHeaderRow(line.segments.map((segment) => segment.text)));
  if (headerIndex < 0) {
    return null;
  }
  let header = lines[headerIndex].segments;
  const headerTexts = header.map((segment) => segment.text);
  const signature = signatureOf(headerTexts);
  const mapping = guessMapping(headerTexts);
  const dateColumn = mapping.operationDate ?? mapping.valueDate;
  const spacing = lineSpacing(lines);

  const rows: string[][] = [headerTexts];
  const uncertain = new Set<string>();
  let last: { row: string[]; index: number; page: number; y: number } | null = null;
  for (const line of lines.slice(headerIndex + 1)) {
    const texts = line.segments.map((segment) => segment.text);
    if (isHeaderRow(texts)) {
      // En-tête répété sur une nouvelle page : ses colonnes peuvent être décalées
      if (signatureOf(texts) === signature) {
        header = line.segments;
      }
      last = null;
      continue;
    }
    const { cells, uncertain: doubtful } = cellsOf(line, header, minConfidence);
    const onlyLabel =
      mapping.label !== null && cells[mapping.label] !== "" && cells.every((cell, index) => index === mapping.label || cell === "");
    if (onlyLabel && last && last.page === line.page && line.y - last.y <= spacing * 2.2) {
      last.row[mapping.label!] = `${last.row[mapping.label!]} ${cells[mapping.label!]}`.trim();
      if (doubtful[mapping.label!]) {
        uncertain.add(`${last.index}:${mapping.label}`);
      }
      last.y = line.y;
      continue;
    }
    rows.push(cells);
    doubtful.forEach((flag, column) => flag && uncertain.add(`${rows.length - 1}:${column}`));
    const isMovement =
      dateColumn !== null &&
      parseStatementDate(cells[dateColumn]) !== null &&
      cells.some((cell) => parseStatementAmount(cell) !== null && !parseStatementDate(cell));
    last = isMovement ? { row: cells, index: rows.length - 1, page: line.page, y: line.y } : null;
  }
  return { rows, uncertain };
}
