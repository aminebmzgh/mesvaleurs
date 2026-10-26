import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, defaultTemplateFor, GENERIC_TEMPLATES } from "./default-templates";
import { parseTemplateOptions, parseZones, type PrintZone } from "./fields";
import { alignedX, fieldValues, layoutInstrument, type MeasureText, type PrintData, wrapWords } from "./layout";

// Mesure simplifiée : chaque caractère vaut 0,2 mm par point de police
const measure: MeasureText = (text, fontSize) => text.length * fontSize * 0.2;
const options = parseTemplateOptions({});

const data: PrintData = {
  type: "check",
  amount: 1234.56,
  payee: "SOTRAMA MATERIAUX",
  place: "Casablanca",
  issueDate: "2026-10-26",
  dueDate: null,
  drawerName: "SOTRAMA MATERIAUX",
  drawerAddress: "Casablanca",
  draweeName: "Atlas Distribution SARL",
  draweeAddress: "45, boulevard Zerktouni, Casablanca",
  rib: "007 780 0001234567890123 96",
  bankBranch: "Casablanca Zerktouni",
  bankCity: "Casablanca",
  cause: "Factures F-2026-0412",
  rectified: false,
};

const zone = (field: PrintZone["field"], width = 100, fontSize = 10): PrintZone => ({
  field,
  x: 10,
  y: 10,
  width,
  fontSize,
  align: "left",
});

describe("fieldValues", () => {
  it("encadre le montant en chiffres contre la falsification", () => {
    expect(fieldValues(data, options).amount_digits).toBe("#1\u00A0234,56#");
    expect(fieldValues(data, { ...options, amountFrame: "*" }).amount_digits).toBe("*1\u00A0234,56*");
    expect(fieldValues(data, { ...options, amountFrame: "none" }).amount_digits).toBe("1\u00A0234,56");
  });

  it("formate dates, lieu et échéance", () => {
    const values = fieldValues({ ...data, type: "lcn", dueDate: "2026-11-25" }, options);
    expect(values.date).toBe("26/10/2026");
    expect(values.place_and_date).toBe("Casablanca, le 26/10/2026");
    expect(values.due_date).toBe("25/11/2026");
  });
});

describe("wrapWords", () => {
  it("remplit les lignes sans couper les mots", () => {
    // 10 pt → 2 mm par caractère ; 30 mm = 15 caractères
    expect(wrapWords("Mille deux cent trente-quatre dirhams", [30, 60], 10, measure)).toEqual({
      lines: ["Mille deux cent", "trente-quatre dirhams"],
      overflowing: false,
    });
  });

  it("place le surplus sur la dernière ligne", () => {
    expect(wrapWords("un deux trois quatre", [8, 8], 10, measure)).toEqual({
      lines: ["un", "deux trois quatre"],
      overflowing: true,
    });
  });

  it("laisse les lignes inutiles vides", () => {
    expect(wrapWords("Cent dirhams", [100, 100], 10, measure).lines).toEqual(["Cent dirhams", ""]);
  });
});

describe("layoutInstrument", () => {
  it("répartit le montant en lettres sur deux lignes", () => {
    const { texts, overflow } = layoutInstrument(
      data,
      [zone("amount_words_1", 60), zone("amount_words_2", 150), zone("payee")],
      options,
      measure,
    );
    expect(texts.find((t) => t.zone.field === "amount_words_1")?.text).toBe("Mille deux cent trente-quatre");
    expect(texts.find((t) => t.zone.field === "amount_words_2")?.text).toBe("dirhams et cinquante-six centimes");
    expect(texts.find((t) => t.zone.field === "payee")?.text).toBe("SOTRAMA MATERIAUX");
    expect(overflow).toEqual([]);
  });

  it("réduit la police d'un texte trop long, puis le signale", () => {
    const fits = layoutInstrument(data, [zone("payee", 30, 10)], options, measure);
    // 17 caractères × 0,2 × taille ≤ 30 mm → taille 8,8 pt
    expect(fits.texts[0].fontSize).toBeLessThan(10);
    expect(fits.overflow).toEqual([]);

    const tooLong = layoutInstrument(data, [zone("payee", 10, 10)], options, measure);
    expect(tooLong.texts[0].fontSize).toBe(6);
    expect(tooLong.overflow).toEqual(["payee"]);
  });

  it("applique les majuscules et l'orthographe rectifiée", () => {
    const { texts } = layoutInstrument(
      { ...data, amount: 21, rectified: true },
      [zone("amount_words_1", 200)],
      { ...options, uppercase: true },
      measure,
    );
    expect(texts[0].text).toBe("VINGT-ET-UN DIRHAMS");
  });

  it("n'imprime rien dans une zone sans valeur", () => {
    expect(layoutInstrument(data, [zone("due_date")], options, measure).texts).toEqual([]);
  });
});

describe("alignedX", () => {
  it("aligne à gauche, au centre ou à droite", () => {
    const base = zone("amount_digits", 40);
    expect(alignedX(base, 10)).toBe(10);
    expect(alignedX({ ...base, align: "right" }, 10)).toBe(40);
    expect(alignedX({ ...base, align: "center" }, 10)).toBe(25);
  });
});

describe("modèles par défaut", () => {
  it("chaque modèle a des zones valides et dans les limites de la formule", () => {
    for (const template of [...DEFAULT_TEMPLATES, ...Object.values(GENERIC_TEMPLATES)]) {
      expect(parseZones(template.zones)).toHaveLength(template.zones.length);
      for (const z of template.zones) {
        expect(z.x + z.width, `${template.key} ${z.field}`).toBeLessThanOrEqual(template.widthMm);
        expect(z.y, `${template.key} ${z.field}`).toBeLessThanOrEqual(template.heightMm);
      }
    }
  });

  it("chèques 175 × 80 mm et LCN 200 × 105 mm", () => {
    for (const template of DEFAULT_TEMPLATES) {
      expect([template.widthMm, template.heightMm]).toEqual(template.type === "check" ? [175, 80] : [200, 105]);
    }
  });

  it("trouve le modèle de la banque, sinon le générique", () => {
    expect(defaultTemplateFor("check", "BP").key).toBe("check-bp");
    expect(defaultTemplateFor("lcn", "CAM").key).toBe("lcn-cam");
    expect(defaultTemplateFor("lcn", "BP").key).toBe("lcn-generic");
    expect(defaultTemplateFor("check", null).key).toBe("check-generic");
  });
});

describe("parseZones", () => {
  it("ignore les zones invalides", () => {
    expect(parseZones([zone("payee"), { field: "inconnu" }, { ...zone("date"), fontSize: 99 }])).toHaveLength(1);
    expect(parseZones("pas un tableau")).toEqual([]);
  });
});
