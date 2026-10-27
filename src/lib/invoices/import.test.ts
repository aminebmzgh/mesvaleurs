import { describe, expect, it } from "vitest";
import type { Cell } from "@/lib/statements/parse";
import { detectInvoiceHeaderRow, guessInvoiceMapping, parseInvoiceRows, supplierNameKey } from "./import";

const ROWS: Cell[][] = [
  ["Export des factures fournisseurs — octobre 2026"],
  [],
  ["Fournisseur", "ICE", "N° facture", "Date facture", "Montant HT", "TVA", "Montant TTC", "Délai"],
  ["Sotrama Matériaux SARL", "001234567000089", "F-2026-0601", "05/10/2026", "10 000,00", "2 000,00", "12 000,00", "60"],
  ["Nouveau Fournisseur SA", "", "NF-1", "06/10/2026", "500,00", "100,00", "", ""],
  ["Sotrama Matériaux SARL", "001234567000089", "F-2026-0601", "05/10/2026", "", "", "12 000,00", ""],
  ["Bureau Pro", "", "BP-1", "pas une date", "", "", "100,00", ""],
  ["", "", "SANS-FOURNISSEUR", "06/10/2026", "", "", "100,00", ""],
  ["Bureau Pro", "", "BP-2", "07/10/2026", "100,00", "20,00", "125,00", ""],
  ["Bureau Pro", "12345", "BP-3", "07/10/2026", "", "", "100,00", ""],
  ["Bureau Pro", "", "BP-4", "07/10/2026", "", "", "-100,00", ""],
  [],
];

describe("détection et correspondance", () => {
  it("trouve l'en-tête et reconnaît les colonnes", () => {
    expect(detectInvoiceHeaderRow(ROWS)).toBe(2);
    expect(guessInvoiceMapping(ROWS[2])).toEqual({
      supplierName: 0,
      supplierIce: 1,
      number: 2,
      issueDate: 3,
      amountExclTax: 4,
      vatAmount: 5,
      amountInclTax: 6,
      paymentTermsDays: 7,
    });
  });

  it("« Montant » seul est le TTC", () => {
    expect(guessInvoiceMapping(["Tiers", "Facture", "Date", "Montant"])).toMatchObject({
      supplierName: 0,
      number: 1,
      issueDate: 2,
      amountInclTax: 3,
    });
  });
});

describe("parseInvoiceRows", () => {
  const result = parseInvoiceRows(ROWS, 2, guessInvoiceMapping(ROWS[2]));

  it("lit les factures valides, TTC calculé si absent", () => {
    expect(result.rows).toEqual([
      {
        line: 4,
        supplierName: "Sotrama Matériaux SARL",
        supplierIce: "001234567000089",
        number: "F-2026-0601",
        issueDate: "2026-10-05",
        amountExclTax: 10000,
        vatAmount: 2000,
        amountInclTax: 12000,
        paymentTermsDays: 60,
      },
      {
        line: 5,
        supplierName: "Nouveau Fournisseur SA",
        supplierIce: null,
        number: "NF-1",
        issueDate: "2026-10-06",
        amountExclTax: 500,
        vatAmount: 100,
        amountInclTax: 600,
        paymentTermsDays: null,
      },
    ]);
  });

  it("signale chaque erreur avec son numéro de ligne", () => {
    expect(result.errors).toEqual([
      { line: 6, message: "Facture en double dans le fichier." },
      { line: 7, message: "Date de facture absente ou illisible." },
      { line: 8, message: "Fournisseur absent (raison sociale ou ICE)." },
      { line: 9, message: "HT + TVA différent du TTC." },
      { line: 10, message: "ICE invalide : 15 chiffres attendus." },
      { line: 11, message: "Montant négatif : saisissez les avoirs à part." },
    ]);
  });
});

describe("supplierNameKey", () => {
  it("ignore casse, accents, ponctuation et formes juridiques", () => {
    expect(supplierNameKey("Sotrama Matériaux SARL")).toBe("SOTRAMA MATERIAUX");
    expect(supplierNameKey("STE SOTRAMA MATERIAUX")).toBe("SOTRAMA MATERIAUX");
    expect(supplierNameKey("Atlas Transport & Logistique")).toBe("ATLAS TRANSPORT LOGISTIQUE");
  });
});
