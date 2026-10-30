import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { addressLines, envelopePdf, isEnvelopeFormat } from "./envelope";
import { MM_TO_PT } from "./fields";

describe("addressLines", () => {
  it("nom en gras, à l'attention de, ville en majuscules ; lignes vides ignorées", () => {
    expect(addressLines({ name: "Sotrama Matériaux SARL", attention: "M. Alaoui", lines: ["12, rue Ibn Sina", "", "Casablanca"] })).toEqual([
      { text: "Sotrama Matériaux SARL", bold: true },
      { text: "À l'attention de M. Alaoui", bold: false },
      { text: "12, rue Ibn Sina", bold: false },
      { text: "CASABLANCA", bold: false },
    ]);
    expect(addressLines({ name: "Atlas", lines: [] })).toEqual([{ text: "Atlas", bold: true }]);
  });
});

describe("envelopePdf", () => {
  it("une page par destinataire, au format choisi", async () => {
    const sender = { name: "Atlas Distribution SARL", lines: ["45, bd Zerktouni", "Casablanca"] };
    const recipient = { name: "Maghreb Emballages SA", attention: "Mme Chraibi", lines: ["Zone industrielle", "Tanger"] };
    const doc = await PDFDocument.load(await envelopePdf("DL", sender, [recipient, recipient]));
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width / MM_TO_PT)).toBe(220);
    expect(Math.round(height / MM_TO_PT)).toBe(110);
  });

  it("formats reconnus", () => {
    expect(isEnvelopeFormat("C5")).toBe(true);
    expect(isEnvelopeFormat("A4")).toBe(false);
    expect(isEnvelopeFormat("toString")).toBe(false);
  });
});
