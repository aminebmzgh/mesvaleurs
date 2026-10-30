import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { MM_TO_PT } from "./fields";
import { toWinAnsi } from "./measure";

/** Formats d'enveloppe courants, à l'italienne (largeur × hauteur en mm). */
export const ENVELOPE_FORMATS = {
  DL: { label: "DL (220 × 110 mm)", width: 220, height: 110 },
  C5: { label: "C5 (229 × 162 mm)", width: 229, height: 162 },
  C6: { label: "C6 (162 × 114 mm)", width: 162, height: 114 },
} as const;

export type EnvelopeFormat = keyof typeof ENVELOPE_FORMATS;

export function isEnvelopeFormat(value: unknown): value is EnvelopeFormat {
  return typeof value === "string" && Object.hasOwn(ENVELOPE_FORMATS, value);
}

export type EnvelopeAddress = { name: string; attention?: string | null; lines: string[] };

/** Bloc d'adresse : nom en gras, « À l'attention de », lignes, ville en majuscules (dernière ligne). */
export function addressLines(address: EnvelopeAddress): { text: string; bold: boolean }[] {
  const lines = address.lines.map((line) => line.trim()).filter(Boolean);
  return [
    { text: address.name, bold: true },
    ...(address.attention ? [{ text: `À l'attention de ${address.attention}`, bold: false }] : []),
    ...lines.map((text, i) => ({ text: i === lines.length - 1 ? text.toLocaleUpperCase("fr") : text, bold: false })),
  ];
}

function drawBlock(page: PDFPage, lines: { text: string; bold: boolean }[], x: number, top: number, size: number, fonts: { regular: PDFFont; bold: PDFFont }, maxWidth: number) {
  let y = top;
  for (const line of lines) {
    const font = line.bold ? fonts.bold : fonts.regular;
    let text = toWinAnsi(line.text);
    // Une ligne trop longue est tronquée plutôt que de déborder de l'enveloppe
    while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxWidth) {
      text = `${text.slice(0, -2)}…`;
    }
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
    y -= size * 1.35;
  }
}

/**
 * Enveloppes (spec §11 bis N) : expéditeur en haut à gauche, destinataire dans la moitié
 * droite, sous le milieu (zone d'adressage). Une page par destinataire.
 */
export async function envelopePdf(format: EnvelopeFormat, sender: EnvelopeAddress, recipients: EnvelopeAddress[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Enveloppes");
  pdf.setCreator("MesValeurs");
  const fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const { width, height } = ENVELOPE_FORMATS[format];
  const [w, h] = [width * MM_TO_PT, height * MM_TO_PT];
  const margin = 12 * MM_TO_PT;

  for (const recipient of recipients) {
    const page = pdf.addPage([w, h]);
    drawBlock(page, addressLines(sender), margin, h - margin - 8, 8, fonts, w / 2 - margin);
    const x = w * 0.48;
    drawBlock(page, addressLines(recipient), x, h * 0.5, 11, fonts, w - x - margin);
  }
  return pdf.save();
}
