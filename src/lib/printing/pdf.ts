import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { MM_TO_PT, type PrintTemplate } from "./fields";
import { alignedX, crossingSegments, layoutInstrument, type PrintData } from "./layout";
import { toWinAnsi } from "./measure";

export { toWinAnsi };

export type Background = { bytes: Uint8Array; mimeType: string };

export type PdfOptions = {
  template: PrintTemplate;
  items: PrintData[];
  /**
   * Impression test sur papier blanc : la formule scannée est imprimée en fond, avec
   * le contour des zones, pour vérifier le calage par superposition.
   */
  test?: { background?: Background; showZones?: boolean };
};

export type PdfResult = { bytes: Uint8Array; overflow: { index: number; fields: string[] }[] };

export async function renderInstrumentsPdf({ template, items, test }: PdfOptions): Promise<PdfResult> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(template.type === "check" ? "Chèques" : "Lettres de change normalisées");
  pdf.setCreator("MesValeurs");
  const font = await pdf.embedFont(template.options.font === "courier" ? StandardFonts.Courier : StandardFonts.Helvetica);
  const measure = (text: string, fontSize: number) => font.widthOfTextAtSize(toWinAnsi(text), fontSize) / MM_TO_PT;

  const pageWidth = template.widthMm * MM_TO_PT;
  const pageHeight = template.heightMm * MM_TO_PT;
  const background = test?.background
    ? test.background.mimeType === "image/png"
      ? await pdf.embedPng(test.background.bytes)
      : await pdf.embedJpg(test.background.bytes)
    : null;

  const overflow: PdfResult["overflow"] = [];
  items.forEach((item, index) => {
    const page = pdf.addPage([pageWidth, pageHeight]);
    if (background) {
      page.drawImage(background, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    }
    if (test?.showZones) {
      for (const zone of template.zones) {
        page.drawRectangle({
          x: (zone.x + template.offsetXMm) * MM_TO_PT,
          y: pageHeight - (zone.y + template.offsetYMm) * MM_TO_PT,
          width: zone.width * MM_TO_PT,
          // Barrement : la zone couvre les deux traits
          height: zone.field === "crossing" ? zone.width * 0.35 * MM_TO_PT : zone.fontSize * 1.1,
          borderColor: rgb(0.2, 0.45, 0.9),
          borderWidth: 0.4,
          opacity: 0,
          borderOpacity: 0.6,
        });
      }
    }

    // Barrement : deux traits parallèles
    for (const zone of template.zones.filter((z) => z.field === "crossing")) {
      for (const segment of crossingSegments(zone)) {
        page.drawLine({
          start: { x: (segment.x1 + template.offsetXMm) * MM_TO_PT, y: pageHeight - (segment.y1 + template.offsetYMm) * MM_TO_PT },
          end: { x: (segment.x2 + template.offsetXMm) * MM_TO_PT, y: pageHeight - (segment.y2 + template.offsetYMm) * MM_TO_PT },
          thickness: 0.8,
          color: rgb(0, 0, 0),
        });
      }
    }

    const layout = layoutInstrument(item, template.zones, template.options, measure);
    if (layout.overflow.length > 0) {
      overflow.push({ index, fields: layout.overflow });
    }
    for (const placed of layout.texts) {
      const text = toWinAnsi(placed.text);
      const widthMm = font.widthOfTextAtSize(text, placed.fontSize) / MM_TO_PT;
      page.drawText(text, {
        x: (alignedX(placed.zone, widthMm) + template.offsetXMm) * MM_TO_PT,
        y: pageHeight - (placed.zone.y + template.offsetYMm) * MM_TO_PT,
        size: placed.fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  });

  return { bytes: await pdf.save(), overflow };
}
