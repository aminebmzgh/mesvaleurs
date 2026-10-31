import { describe, expect, it } from "vitest";
import { isInternalPath, parseInline, parseMarkdown } from "./markdown";

describe("parseInline", () => {
  it("gras et liens internes", () => {
    expect(parseInline("Vous devez **12 000,00 DH** à [Sotrama](/fournisseurs/abc).")).toEqual([
      { type: "text", text: "Vous devez " },
      { type: "strong", text: "12 000,00 DH" },
      { type: "text", text: " à " },
      { type: "link", text: "Sotrama", href: "/fournisseurs/abc" },
      { type: "text", text: "." },
    ]);
  });

  it("lien externe ou suspect : texte seul", () => {
    expect(parseInline("[ici](https://exemple.com)")).toEqual([{ type: "text", text: "ici" }]);
    expect(parseInline("[ici](//exemple.com)")).toEqual([{ type: "text", text: "ici" }]);
    expect(parseInline("[ici](javascript:alert(1))")).toEqual([{ type: "text", text: "ici" }, { type: "text", text: ")" }]);
  });
});

describe("isInternalPath", () => {
  it("chemins de l'application seulement", () => {
    expect(isInternalPath("/paiements?numero=1003&statut=all")).toBe(true);
    expect(isInternalPath("/factures/f0000000-0000-4000-8000-000000000004")).toBe(true);
    expect(isInternalPath("https://x.ma/")).toBe(false);
    expect(isInternalPath("/\\evil")).toBe(false);
  });
});

describe("parseMarkdown", () => {
  it("tableau : en-tête, séparateur ignoré, lignes", () => {
    expect(parseMarkdown("Chèques :\n| Chèque | Montant |\n|---|---:|\n| [0001005](/paiements?numero=1005) | 12 000,00 DH |\n| 0001003 | 8 450,50 DH |")).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Chèques :" }] },
      {
        type: "table",
        header: [[{ type: "text", text: "Chèque" }], [{ type: "text", text: "Montant" }]],
        rows: [
          [[{ type: "link", text: "0001005", href: "/paiements?numero=1005" }], [{ type: "text", text: "12 000,00 DH" }]],
          [[{ type: "text", text: "0001003" }], [{ type: "text", text: "8 450,50 DH" }]],
        ],
      },
    ]);
  });

  it("paragraphes, listes à puces et numérotées, titres", () => {
    expect(parseMarkdown("## Synthèse\nDeux chèques\nen circulation :\n\n- Chèque 1003\n- Chèque 1004\n1. Premier\n2. Second")).toEqual([
      { type: "paragraph", content: [{ type: "strong", text: "Synthèse" }, { type: "text", text: " Deux chèques en circulation :" }] },
      { type: "list", ordered: false, items: [[{ type: "text", text: "Chèque 1003" }], [{ type: "text", text: "Chèque 1004" }]] },
      { type: "list", ordered: true, items: [[{ type: "text", text: "Premier" }], [{ type: "text", text: "Second" }]] },
    ]);
  });
});
