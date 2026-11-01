import { describe, expect, it } from "vitest";
import { guessMapping } from "../parse";
import { PdfStatementError } from "../pdf/parsers";
import { itemsFromOcr, type OcrLine, tableFromOcr } from "./items";
import { parseReviewLines, reviewLines } from "./review";

/** Ligne Tesseract sur une image de 1190 px de large (2 px par point), mots [x, texte, confiance]. */
const ocrLine = (baseline: number, words: [number, string, number?][], skew = 0): OcrLine => ({
  bbox: { x0: 0, y0: baseline - 20, x1: 1190, y1: baseline + 4 },
  baseline: { x0: 0, y0: baseline, x1: 1190, y1: baseline + skew, has_baseline: true },
  words: words.map(([x, text, confidence = 95], index) => ({
    text,
    confidence,
    // Page légèrement de travers : chaque mot un peu plus bas que le précédent
    bbox: { x0: x * 2, y0: baseline - 18 + index * 2, x1: x * 2 + text.length * 10, y1: baseline + index * 2 },
  })),
});

const page = [
  ocrLine(80, [[40, "BANQUE"], [100, "POPULAIRE"]]),
  ocrLine(200, [[40, "Date"], [100, "Libellé"], [400, "Débit"], [480, "Crédit"]]),
  ocrLine(230, [[40, "03/10/2026"], [100, "CHQ"], [118, "0001234"], [390, "2 500,00", 62]], 6),
  ocrLine(260, [[40, "05/10/2026"], [100, "VIR"], [118, "RECU"], [475, "8 000,00"]]),
  ocrLine(290, [[40, "06/10/2026", 40], [100, "FRAIS"], [400, "3S,00"]]),
];

describe("itemsFromOcr", () => {
  it("ramène l'image à l'échelle d'une page A4 et aligne les mots sur la ligne de base", () => {
    const items = itemsFromOcr([{ paragraphs: [{ lines: page }] }], 1, 1190);
    const cheque = items.filter((item) => item.text === "03/10/2026" || item.text === "2 500,00");
    expect(cheque.map((item) => item.x)).toEqual([40, 390]);
    // Même hauteur pour tous les mots de la ligne, malgré l'inclinaison
    expect(new Set(cheque.map((item) => item.y)).size).toBe(1);
    expect(items.find((item) => item.text === "2 500,00")!.confidence).toBe(62);
  });
});

describe("tableFromOcr", () => {
  const table = tableFromOcr(itemsFromOcr([{ paragraphs: [{ lines: page }] }], 1, 1190));

  it("tableau reconstitué et cellules incertaines repérées", () => {
    expect(table.rows[0]).toEqual(["Date", "Libellé", "Débit", "Crédit"]);
    expect(table.rows[1]).toEqual(["03/10/2026", "CHQ 0001234", "2 500,00", ""]);
    expect([...table.uncertain].sort()).toEqual(["1:2", "3:0"]);
  });

  it("page sans texte ou sans en-tête : explication", () => {
    expect(() => tableFromOcr([])).toThrow(PdfStatementError);
    expect(() => tableFromOcr(itemsFromOcr([{ paragraphs: [{ lines: [page[0]] }] }], 1, 1190))).toThrow(/colonnes/);
  });

  it("lignes à vérifier : lectures incertaines et montants illisibles signalés", () => {
    const lines = reviewLines(table.rows, 0, guessMapping(table.rows[0]), table.uncertain);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ operationDate: "2026-10-03", label: "CHQ 0001234", debit: expect.stringMatching(/^2\s500,00$/), doubtful: ["debit"] });
    expect(lines[1].doubtful).toEqual([]);
    expect(lines[2]).toMatchObject({ debit: "3S,00", doubtful: ["debit", "operationDate"] });

    const first = parseReviewLines(lines);
    expect(first.lines).toHaveLength(2);
    expect(first.errors.get(lines[2].id)).toMatch(/Montant illisible/);

    const fixed = parseReviewLines(lines.map((line) => (line.id === lines[2].id ? { ...line, debit: "35,00" } : line)));
    expect(fixed.errors.size).toBe(0);
    expect(fixed.lines[2]).toMatchObject({ operationDate: "2026-10-06", label: "FRAIS", debit: 35, credit: null });
  });
});

describe("parseReviewLines", () => {
  const base = { id: "a", operationDate: "2026-10-03", valueDate: null, label: "FRAIS", reference: null, debit: "", credit: "", doubtful: [] };

  it("exige une date, un libellé et un seul montant", () => {
    expect(parseReviewLines([{ ...base, operationDate: "" }]).errors.get("a")).toMatch(/Date/);
    expect(parseReviewLines([{ ...base, label: " ", debit: "10" }]).errors.get("a")).toMatch(/Libellé/);
    expect(parseReviewLines([base]).errors.get("a")).toMatch(/soit un débit, soit un crédit/);
    expect(parseReviewLines([{ ...base, debit: "10", credit: "5" }]).errors.get("a")).toMatch(/soit un débit/);
    expect(parseReviewLines([{ ...base, credit: "1 234,56" }]).lines[0].credit).toBe(1234.56);
  });
});
