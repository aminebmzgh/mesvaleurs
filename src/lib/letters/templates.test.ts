import { describe, expect, it } from "vitest";
import {
  BUILTIN_TEMPLATES,
  findBuiltinTemplate,
  LETTER_KIND_VARIABLES,
  type LetterKind,
  type LetterValues,
  renderLetterText,
  suggestedTemplateKey,
} from "./templates";

const values: LetterValues = {
  fournisseur: "Sotrama Matériaux SARL",
  entreprise: "Atlas Distribution SARL",
  lieu: "Casablanca",
  date: "28/10/2026",
  reference: "RG-20261028-1006",
  factures: "F-2026-0412, F-2026-0498",
  moyens: "2 chèques",
  total: "48 000,00 DH",
  total_lettres: "quarante-huit mille dirhams",
  reste_du: "0,00 DH",
  signataire: "Karim Benali",
};

describe("renderLetterText", () => {
  it("remplace les variables", () => {
    expect(renderLetterText("Ci-joint {moyens} de {total} ({total_lettres}).", values)).toBe(
      "Ci-joint 2 chèques de 48 000,00 DH (quarante-huit mille dirhams).",
    );
  });

  it("laisse visible une variable inconnue", () => {
    expect(renderLetterText("Bonjour {contact}", values)).toBe("Bonjour {contact}");
  });

  it("les modèles intégrés n'utilisent que les variables de leur type de courrier", () => {
    for (const [kind, templates] of Object.entries(BUILTIN_TEMPLATES) as [LetterKind, typeof BUILTIN_TEMPLATES.cover_letter][]) {
      expect(templates.length, kind).toBeGreaterThan(0);
      for (const template of templates) {
        for (const text of [template.subject, template.body, template.closing]) {
          for (const [, name] of text.matchAll(/\{([a-z_]+)\}/g)) {
            expect(Object.keys(LETTER_KIND_VARIABLES[kind]), `${template.key} : {${name}}`).toContain(name);
          }
        }
      }
    }
  });

  it("les clés des modèles intégrés sont uniques, tous types confondus", () => {
    const keys = Object.values(BUILTIN_TEMPLATES).flat().map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(findBuiltinTemplate("prorogation")?.kind).toBe("postponement_request");
    expect(findBuiltinTemplate("inconnu")).toBeNull();
  });
});

describe("suggestedTemplateKey", () => {
  it("acompte s'il reste dû, LCN, sinon standard", () => {
    expect(suggestedTemplateKey({ hasLcn: true, remainingCents: 100 })).toBe("acompte");
    expect(suggestedTemplateKey({ hasLcn: true, remainingCents: 0 })).toBe("lcn");
    expect(suggestedTemplateKey({ hasLcn: false, remainingCents: 0 })).toBe("standard");
  });
});
