import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { defaultTemplateFor } from "./default-templates";
import { MM_TO_PT } from "./fields";
import type { PrintData } from "./layout";
import { renderInstrumentsPdf, toWinAnsi } from "./pdf";

const item: PrintData = {
  type: "check",
  amount: 15600,
  payee: "SOTRAMA MATÉRIAUX — Fès",
  place: "Casablanca",
  issueDate: "2026-10-26",
  dueDate: null,
  drawerName: "",
  drawerAddress: "",
  draweeName: "",
  draweeAddress: "",
  rib: "",
  bankBranch: "",
  bankCity: "",
  cause: "",
  rectified: false,
};

describe("toWinAnsi", () => {
  it("conserve les accents français et remplace l'inencodable", () => {
    expect(toWinAnsi("Élise Çà « œuvre »")).toBe("Élise Çà « œuvre »");
    expect(toWinAnsi("1\u202F234")).toBe("1\u00A0234");
    expect(toWinAnsi("مطبعة")).toBe("?????");
    expect(toWinAnsi("l\u2019ordre")).toBe("l'ordre");
  });
});

describe("renderInstrumentsPdf", () => {
  it("une page par formule, aux dimensions exactes de la formule", async () => {
    const template = defaultTemplateFor("check", "AWB");
    const { bytes, overflow } = await renderInstrumentsPdf({ template, items: [item, { ...item, amount: 1 }] });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(175 * MM_TO_PT, 3);
    expect(height).toBeCloseTo(80 * MM_TO_PT, 3);
    expect(overflow).toEqual([]);
  });

  it("produit une LCN 200 × 105 mm et signale un bénéficiaire trop long", async () => {
    const template = defaultTemplateFor("lcn", "AWB");
    const { bytes, overflow } = await renderInstrumentsPdf({
      template,
      items: [{ ...item, type: "lcn", dueDate: "2026-12-25", payee: "X".repeat(200) }],
      test: { showZones: true },
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPage(0).getSize().width).toBeCloseTo(200 * MM_TO_PT, 3);
    expect(overflow).toEqual([{ index: 0, fields: ["payee"] }]);
  });
});
