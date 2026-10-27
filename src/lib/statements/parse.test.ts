import { describe, expect, it } from "vitest";
import {
  type Cell,
  detectHeaderRow,
  guessMapping,
  lineKeys,
  parseRows,
  parseStatementAmount,
  parseStatementDate,
  statementPeriod,
} from "./parse";

describe("parseStatementDate", () => {
  it.each([
    ["03/10/2026", "2026-10-03"],
    ["3/1/2026", "2026-01-03"],
    ["03-10-26", "2026-10-03"],
    ["03.10.2026", "2026-10-03"],
    ["2026-10-03", "2026-10-03"],
    ["2026-10-03T00:00:00", "2026-10-03"],
    [46298, "2026-10-03"], // numéro de série Excel
    [new Date(2026, 9, 3), "2026-10-03"],
  ] as [Cell, string][])("%s → %s", (cell, expected) => {
    expect(parseStatementDate(cell)).toBe(expected);
  });

  it.each(["31/02/2026", "SOLDE AU 30/09", "", "13/13/2026", 12, null] as Cell[])("refuse %s", (cell) => {
    expect(parseStatementDate(cell)).toBeNull();
  });
});

describe("parseStatementAmount", () => {
  it.each([
    ["24 000,00", 24000],
    ["24\u00A0000,00", 24000],
    ["1.234,56", 1234.56],
    ["1234.56", 1234.56],
    ["1.234.567", 1234567],
    ["-45,00", -45],
    ["(45,00)", -45],
    ["45,00-", -45],
    ["45,00 DB", -45],
    ["+50 000,00", 50000],
    ["3 200,00 DH", 3200],
    [15060, 15060],
    [0.1 + 0.2, 0.3],
  ] as [Cell, number][])("%s → %s", (cell, expected) => {
    expect(parseStatementAmount(cell)).toBe(expected);
  });

  it.each(["", "-", "abc", null, undefined] as Cell[])("vide ou illisible : %s → null", (cell) => {
    expect(parseStatementAmount(cell)).toBeNull();
  });
});

// Relevé exporté type : titre, informations du compte, puis tableau
const ROWS: Cell[][] = [
  ["ATTIJARIWAFA BANK — RELEVÉ DE COMPTE"],
  ["Compte : 007780000123456789012396", "", "Période : octobre 2026"],
  [],
  ["Date opération", "Date valeur", "Libellé", "Débit", "Crédit"],
  ["", "", "SOLDE AU 30/09/2026", "", "250 000,00"],
  ["03/10/2026", "03/10/2026", "CHQ 0001000 SOTRAMA", "24 000,00", ""],
  ["06/10/2026", "06/10/2026", "PAIEMENT CHEQUE N°1001", "24 000,00", ""],
  ["08/10/2026", "08/10/2026", "FRAIS TENUE DE COMPTE", "45,00", ""],
  ["08/10/2026", "08/10/2026", "FRAIS TENUE DE COMPTE", "45,00", ""],
  ["22/10/2026", "22/10/2026", "VIREMENT RECU CLIENT MARJANE", "", "50 000,00"],
  ["25/10/2026", "25/10/2026", "LIGNE SANS MONTANT", "", ""],
  ["", "", "TOTAL DES MOUVEMENTS", "48 090,00", "50 000,00"],
];

describe("detectHeaderRow / guessMapping", () => {
  it("trouve l'en-tête après les lignes de titre", () => {
    expect(detectHeaderRow(ROWS)).toBe(3);
  });

  it("propose la correspondance des colonnes", () => {
    expect(guessMapping(ROWS[3])).toEqual({
      operationDate: 0,
      valueDate: 1,
      label: 2,
      reference: null,
      debit: 3,
      credit: 4,
      amount: null,
    });
  });

  it("reconnaît une colonne de montant signé et une référence", () => {
    expect(guessMapping(["Date", "Réf.", "Désignation", "Montant"])).toEqual({
      operationDate: 0,
      valueDate: null,
      label: 2,
      reference: 1,
      debit: null,
      credit: null,
      amount: 3,
    });
  });
});

describe("parseRows", () => {
  const mapping = guessMapping(ROWS[3]);

  it("lit les mouvements et ignore soldes et totaux", () => {
    const result = parseRows(ROWS, 3, mapping);
    expect(result.lines).toHaveLength(5);
    expect(result.lines[0]).toEqual({
      operationDate: "2026-10-03",
      valueDate: "2026-10-03",
      label: "CHQ 0001000 SOTRAMA",
      reference: null,
      debit: 24000,
      credit: null,
    });
    expect(result.lines[4]).toMatchObject({ credit: 50000, debit: null });
    expect(result.skipped).toBe(2); // solde initial et total
    expect(result.errors).toEqual([{ row: 11, message: "Montant illisible ou absent." }]);
  });

  it("répartit un montant signé entre débit et crédit", () => {
    const rows: Cell[][] = [
      ["Date", "Libellé", "Montant"],
      ["01/10/2026", "CHQ 0001002", "-15 060,00"],
      ["02/10/2026", "VERSEMENT", "1 000,00"],
    ];
    const result = parseRows(rows, 0, guessMapping(rows[0]));
    expect(result.lines.map((l) => [l.debit, l.credit])).toEqual([
      [15060, null],
      [null, 1000],
    ]);
  });
});

describe("lineKeys / statementPeriod", () => {
  it("distingue deux lignes identiques le même jour", () => {
    const { lines } = parseRows(ROWS, 3, guessMapping(ROWS[3]));
    const keys = lineKeys(lines);
    expect(new Set(keys).size).toBe(lines.length);
    expect(keys[2]).toMatch(/\|1$/);
    expect(keys[3]).toMatch(/\|2$/);
    // Clés stables : un nouvel import du même relevé produit les mêmes clés
    expect(lineKeys(lines)).toEqual(keys);
  });

  it("calcule la période couverte", () => {
    const { lines } = parseRows(ROWS, 3, guessMapping(ROWS[3]));
    expect(statementPeriod(lines)).toEqual({ start: "2026-10-03", end: "2026-10-22" });
    expect(statementPeriod([])).toBeNull();
  });
});
