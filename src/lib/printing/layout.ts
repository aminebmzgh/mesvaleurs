import { amountInWords } from "@/lib/amount-in-words";
import { formatAmount, formatDate } from "@/lib/format";
import { NON_ENDORSABLE_TEXT, type PrintField, type PrintZone, type TemplateOptions } from "./fields";

/** Informations imprimées sur une formule. */
export type PrintData = {
  type: "check" | "lcn";
  amount: number;
  payee: string;
  place: string;
  issueDate: string;
  dueDate: string | null;
  /** Tireur d'une LCN : le fournisseur créancier. */
  drawerName: string;
  drawerAddress: string;
  /** Tiré d'une LCN : l'entreprise qui paie. */
  draweeName: string;
  draweeAddress: string;
  rib: string;
  bankBranch: string;
  bankCity: string;
  /** Cause de la LCN : références des factures réglées. */
  cause: string;
  rectified: boolean;
};

/** Largeur d'un texte, en millimètres, pour une taille de police (en points). */
export type MeasureText = (text: string, fontSize: number) => number;

export type PlacedText = { zone: PrintZone; text: string; fontSize: number };

export type LayoutResult = { texts: PlacedText[]; overflow: PrintField[] };

/** Taille minimale à laquelle un texte trop long est réduit avant d'être signalé. */
const MIN_FONT_SIZE = 6;
const WORD_LINES: PrintField[] = ["amount_words_1", "amount_words_2", "amount_words_3"];

/** Texte brut de chaque zone, hors montant en lettres (réparti à part). */
export function fieldValues(data: PrintData, options: TemplateOptions): Partial<Record<PrintField, string>> {
  const digits = formatAmount(data.amount);
  const frame = options.amountFrame === "none" ? "" : options.amountFrame;
  const date = formatDate(data.issueDate);
  return {
    amount_digits: `${frame}${digits}${frame}`,
    payee: data.payee,
    place: data.place,
    date,
    place_and_date: data.place ? `${data.place}, le ${date}` : date,
    due_date: data.dueDate ? formatDate(data.dueDate) : "",
    drawer_name: data.drawerName,
    drawer_address: data.drawerAddress,
    drawee_name: data.draweeName,
    drawee_address: data.draweeAddress,
    account_rib: data.rib,
    bank_branch: data.bankBranch,
    bank_city: data.bankCity,
    cause: data.cause,
    stub_payee: data.payee,
    stub_amount: `${digits} DH`,
    stub_date: date,
    stub_due_date: data.dueDate ? formatDate(data.dueDate) : "",
    stub_cause: data.cause,
    non_endorsable: NON_ENDORSABLE_TEXT,
    // Le barrement est tracé, pas écrit (voir crossingSegments)
    crossing: "",
  };
}

/** Écart entre les deux traits du barrement, en millimètres. */
const CROSSING_GAP_MM = 4;

/**
 * Barrement : deux traits parallèles obliques dans la zone, de la ligne de base (en bas
 * à gauche) vers le haut à droite ; hauteur proportionnelle à la largeur.
 */
export function crossingSegments(zone: PrintZone): { x1: number; y1: number; x2: number; y2: number }[] {
  const height = zone.width * 0.35;
  const gap = Math.min(CROSSING_GAP_MM, zone.width / 3);
  return [
    { x1: zone.x, y1: zone.y, x2: zone.x + zone.width - gap, y2: zone.y - height },
    { x1: zone.x + gap, y1: zone.y, x2: zone.x + zone.width, y2: zone.y - height },
  ];
}

/**
 * Répartit des mots sur plusieurs lignes de largeurs données, sans couper un mot.
 * Renvoie les lignes et le texte restant s'il ne tient pas (placé sur la dernière ligne).
 */
export function wrapWords(
  text: string,
  lineWidths: number[],
  fontSize: number,
  measure: MeasureText,
): { lines: string[]; overflowing: boolean } {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let index = 0;
  for (let line = 0; line < lineWidths.length; line += 1) {
    let current = "";
    while (index < words.length) {
      const candidate = current ? `${current} ${words[index]}` : words[index];
      if (current && measure(candidate, fontSize) > lineWidths[line]) {
        break;
      }
      current = candidate;
      index += 1;
    }
    lines.push(current);
  }
  if (index < words.length) {
    // Ce qui ne tient pas va sur la dernière ligne, qui sera réduite si besoin
    lines[lines.length - 1] = [lines.at(-1), ...words.slice(index)].filter(Boolean).join(" ");
    return { lines, overflowing: true };
  }
  return { lines, overflowing: false };
}

/** Réduit la police jusqu'à ce que le texte tienne dans sa zone (au minimum 6 pt). */
function fitFontSize(text: string, zone: PrintZone, measure: MeasureText): { fontSize: number; fits: boolean } {
  let fontSize = zone.fontSize;
  while (fontSize > MIN_FONT_SIZE && measure(text, fontSize) > zone.width) {
    fontSize = Math.max(MIN_FONT_SIZE, Math.round((fontSize - 0.5) * 10) / 10);
  }
  return { fontSize, fits: measure(text, fontSize) <= zone.width };
}

/** Place les textes d'une formule dans les zones du modèle. */
export function layoutInstrument(
  data: PrintData,
  zones: PrintZone[],
  options: TemplateOptions,
  measure: MeasureText,
): LayoutResult {
  const values = fieldValues(data, options);
  const transform = (text: string) => (options.uppercase ? text.toLocaleUpperCase("fr") : text);
  const texts: PlacedText[] = [];
  const overflow: PrintField[] = [];

  const place = (zone: PrintZone, raw: string) => {
    const text = transform(raw);
    if (!text) {
      return;
    }
    const { fontSize, fits } = fitFontSize(text, zone, measure);
    if (!fits) {
      overflow.push(zone.field);
    }
    texts.push({ zone, text, fontSize });
  };

  // Montant en lettres sur les lignes prévues par le modèle, dans l'ordre
  const wordZones = WORD_LINES.flatMap((field) => zones.filter((z) => z.field === field));
  if (wordZones.length > 0) {
    const words = transform(amountInWords(data.amount, { rectified: data.rectified }));
    const { lines } = wrapWords(words, wordZones.map((z) => z.width), wordZones[0].fontSize, measure);
    lines.forEach((line, i) => place(wordZones[i], line));
  }

  for (const zone of zones) {
    if (!WORD_LINES.includes(zone.field)) {
      place(zone, values[zone.field] ?? "");
    }
  }
  return { texts, overflow };
}

/** Abscisse de départ du texte selon l'alignement de la zone. */
export function alignedX(zone: PrintZone, textWidth: number): number {
  if (zone.align === "right") {
    return zone.x + zone.width - textWidth;
  }
  if (zone.align === "center") {
    return zone.x + (zone.width - textWidth) / 2;
  }
  return zone.x;
}
