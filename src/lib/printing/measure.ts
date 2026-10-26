import { StandardFontEmbedder, StandardFonts } from "pdf-lib";
import { MM_TO_PT, type TemplateOptions } from "./fields";
import type { MeasureText } from "./layout";

/**
 * Les polices standard PDF (WinAnsi) couvrent le français mais pas l'arabe ni
 * certains espaces : ces caractères sont remplacés pour ne jamais faire échouer
 * l'impression.
 */
export function toWinAnsi(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u202F\u2007\u2009]/g, "\u00A0")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^ -~\u00A0-ÿ€–—…Œœ]/g, "?");
}

// StandardFonts et FontNames (pdf-lib) portent les mêmes noms de police
type FontName = Parameters<typeof StandardFontEmbedder.for>[0];

const FONTS: Record<TemplateOptions["font"], FontName> = {
  helvetica: StandardFonts.Helvetica as unknown as FontName,
  courier: StandardFonts.Courier as unknown as FontName,
};

/**
 * Mesure exacte d'un texte (en mm) avec les métriques de la police PDF : l'éditeur
 * et le PDF coupent les lignes exactement au même endroit.
 */
export function measureFor(font: TemplateOptions["font"]): MeasureText {
  const embedder = StandardFontEmbedder.for(FONTS[font]);
  return (text, fontSize) => embedder.widthOfTextAtSize(toWinAnsi(text), fontSize) / MM_TO_PT;
}
