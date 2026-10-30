import { describe, expect, it } from "vitest";
import { guessMapping, parseRows } from "../parse";
import { groupLines, type PdfTextItem, tableFromLines } from "./layout";
import { PdfStatementError, parsePdfStatement } from "./parsers";

/** Ligne de texte : morceaux [x, texte], largeur approximée à 5 points par caractère. */
const line = (y: number, parts: [number, string][], page = 1): PdfTextItem[] =>
  parts.map(([x, text]) => ({ text, x, y, width: text.length * 5, height: 9, page }));

const HEADER: [number, string][] = [
  [40, "Date"],
  [100, "Valeur"],
  [160, "Libellé"],
  [400, "Débit"],
  [480, "Crédit"],
];

const statement: PdfTextItem[] = [
  ...line(40, [[40, "ATTIJARIWAFA BANK — Relevé de compte"]]),
  ...line(60, [[40, "Période du 01/10/2026 au 31/10/2026"]]),
  ...line(100, HEADER),
  ...line(115, [[40, "Solde précédent"], [470, "10 000,00"]]),
  ...line(130, [[40, "03/10/2026"], [100, "03/10/2026"], [160, "CHQ 0001234"], [390, "2 500,00"]]),
  // Libellé sur deux lignes
  ...line(141, [[160, "SOTRAMA MATERIAUX"]]),
  // Morceaux voisins d'un même libellé
  ...line(156, [[40, "05/10/2026"], [100, "05/10/2026"], [160, "VIR RECU"], [202, "CLIENT ATLAS"], [475, "8 000,00"]]),
  ...line(400, [[260, "Page 1/2"]]),
  // Page 2 : en-tête répété, colonnes décalées
  ...line(40, [[40, "ATTIJARIWAFA BANK"]], 2),
  ...line(100, HEADER.map(([x, text]) => [x + 10, text] as [number, string]), 2),
  ...line(130, [[50, "12/10/2026"], [110, "13/10/2026"], [170, "LCN 0000042 ECH"], [400, "1 200,50"]], 2),
  ...line(160, [[50, "Total des mouvements"], [400, "3 700,50"], [490, "8 000,00"]], 2),
];

describe("groupLines", () => {
  it("lignes ordonnées par page puis hauteur, morceaux proches fusionnés", () => {
    const lines = groupLines(statement);
    expect(lines[0].segments.map((s) => s.text)).toEqual(["ATTIJARIWAFA BANK — Relevé de compte"]);
    const transfer = lines.find((l) => l.y === 156)!;
    expect(transfer.segments.map((s) => s.text)).toEqual(["05/10/2026", "05/10/2026", "VIR RECU CLIENT ATLAS", "8 000,00"]);
    expect(lines.at(-1)!.page).toBe(2);
  });

  it("légers décalages verticaux : même ligne", () => {
    const lines = groupLines([...line(100, [[40, "03/10/2026"]]), ...line(101.5, [[160, "FRAIS"]])]);
    expect(lines).toHaveLength(1);
  });
});

describe("tableFromLines", () => {
  const rows = tableFromLines(groupLines(statement))!;

  it("en-tête puis cellules rangées sous leur colonne", () => {
    expect(rows[0]).toEqual(["Date", "Valeur", "Libellé", "Débit", "Crédit"]);
    expect(rows).toContainEqual(["03/10/2026", "03/10/2026", "CHQ 0001234 SOTRAMA MATERIAUX", "2 500,00", ""]);
    expect(rows).toContainEqual(["05/10/2026", "05/10/2026", "VIR RECU CLIENT ATLAS", "", "8 000,00"]);
  });

  it("en-tête répété écarté, colonnes de la nouvelle page", () => {
    expect(rows.filter((row) => row[0] === "Date")).toHaveLength(1);
    expect(rows).toContainEqual(["12/10/2026", "13/10/2026", "LCN 0000042 ECH", "1 200,50", ""]);
  });

  it("lu ensuite comme un export : soldes, totaux et pieds de page ignorés", () => {
    const parsed = parseRows(rows, 0, guessMapping(rows[0]));
    expect(parsed.errors).toEqual([]);
    expect(parsed.lines).toEqual([
      { operationDate: "2026-10-03", valueDate: "2026-10-03", label: "CHQ 0001234 SOTRAMA MATERIAUX", reference: null, debit: 2500, credit: null },
      { operationDate: "2026-10-05", valueDate: "2026-10-05", label: "VIR RECU CLIENT ATLAS", reference: null, debit: null, credit: 8000 },
      { operationDate: "2026-10-12", valueDate: "2026-10-13", label: "LCN 0000042 ECH", reference: null, debit: 1200.5, credit: null },
    ]);
  });

  it("sans en-tête reconnu : null", () => {
    expect(tableFromLines(groupLines(line(100, [[40, "Bonjour"], [200, "Madame"]])))).toBeNull();
  });
});

describe("parsePdfStatement", () => {
  it("analyseur générique par défaut", () => {
    const result = parsePdfStatement(statement, 2);
    expect(result.parser.id).toBe("generic");
    expect(result.rows[0]).toEqual(["Date", "Valeur", "Libellé", "Débit", "Crédit"]);
  });

  it("analyseur dédié essayé d'abord s'il reconnaît le document, générique en secours", () => {
    const dedicated = { id: "awb", name: "Attijariwafa bank", detect: (text: string) => text.includes("ATTIJARIWAFA"), parse: () => [["Date"], ["01/10/2026"]] };
    expect(parsePdfStatement(statement, 2, [dedicated]).parser.id).toBe("awb");
    expect(parsePdfStatement(statement, 2, [{ ...dedicated, parse: () => null }]).parser.id).toBe("generic");
    expect(parsePdfStatement(statement, 2, [{ ...dedicated, detect: () => false }]).parser.id).toBe("generic");
  });

  it("PDF scanné ou illisible : erreur explicite", () => {
    expect(() => parsePdfStatement(line(10, [[10, "p. 1"]]), 3)).toThrow(PdfStatementError);
    try {
      parsePdfStatement(line(10, [[10, "Un courrier sans tableau de mouvements, assez long pour du texte."]]), 1);
    } catch (error) {
      expect((error as PdfStatementError).reason).toBe("unreadable");
    }
    expect.assertions(2);
  });
});
