import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { amountInWords } from "@/lib/amount-in-words";
import { formatDate, formatMAD } from "@/lib/format";
import { toWinAnsi } from "@/lib/printing/measure";
import type { CoverLetterData } from "./data";
import { type LetterTemplate, type LetterValues, renderLetterText } from "./templates";

const [WIDTH, HEIGHT, MARGIN] = [595.28, 841.89, 50];
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.4, 0.4, 0.4);

type Column = { header: string; width: number; align?: "left" | "right" };

/** Mise en page A4 simple : curseur vertical, retour à la ligne, tableaux, pagination. */
class Writer {
  page: PDFPage;
  y = HEIGHT - MARGIN;
  constructor(
    private pdf: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
    private footer: string,
  ) {
    this.page = this.newPage();
  }

  private newPage() {
    const page = this.pdf.addPage([WIDTH, HEIGHT]);
    if (this.footer) {
      page.drawText(toWinAnsi(this.footer), { x: MARGIN, y: 25, size: 8, font: this.font, color: MUTED });
    }
    return page;
  }

  ensure(space: number) {
    if (this.y - space < MARGIN) {
      this.page = this.newPage();
      this.y = HEIGHT - MARGIN;
    }
  }

  width(text: string, size: number, f: PDFFont = this.font) {
    return f.widthOfTextAtSize(toWinAnsi(text), size);
  }

  text(text: string, x: number, size = 10, f: PDFFont = this.font, color = INK) {
    this.page.drawText(toWinAnsi(text), { x, y: this.y, size, font: f, color });
  }

  /** Coupe un paragraphe en lignes tenant dans `maxWidth`. */
  wrap(text: string, maxWidth: number, size: number, f: PDFFont = this.font): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && this.width(candidate, size, f) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  paragraph(text: string, size = 10, f: PDFFont = this.font, x = MARGIN, maxWidth = WIDTH - 2 * MARGIN) {
    for (const line of this.wrap(text, maxWidth, size, f)) {
      this.ensure(size + 4);
      this.y -= size + 4;
      if (line) {
        this.text(line, x, size, f);
      }
    }
  }

  table(columns: Column[], rows: string[][], footer?: string[]) {
    const draw = (cells: string[], f: PDFFont, line: boolean) => {
      this.ensure(18);
      this.y -= 14;
      let x = MARGIN;
      cells.forEach((cell, i) => {
        const column = columns[i];
        let value = toWinAnsi(cell);
        while (value.length > 1 && f.widthOfTextAtSize(value, 9) > column.width - 6) {
          value = `${value.slice(0, -2)}…`;
        }
        const w = f.widthOfTextAtSize(value, 9);
        this.page.drawText(value, { x: column.align === "right" ? x + column.width - 4 - w : x + 2, y: this.y, size: 9, font: f, color: INK });
        x += column.width;
      });
      if (line) {
        this.page.drawLine({
          start: { x: MARGIN, y: this.y - 4 },
          end: { x: MARGIN + columns.reduce((s, c) => s + c.width, 0), y: this.y - 4 },
          thickness: 0.5,
          color: MUTED,
        });
      }
    };
    draw(columns.map((c) => c.header), this.bold, true);
    rows.forEach((row) => draw(row, this.font, false));
    if (footer) {
      draw(footer, this.bold, false);
    }
    this.y -= 6;
  }

  box(x: number, width: number, height: number, title: string) {
    this.page.drawRectangle({ x, y: this.y - height, width, height, borderColor: MUTED, borderWidth: 0.7 });
    this.page.drawText(toWinAnsi(title), { x: x + 6, y: this.y - 13, size: 9, font: this.bold, color: INK });
  }
}

async function embedLogo(pdf: PDFDocument, logo: CoverLetterData["organization"]["logo"]) {
  if (!logo) {
    return null;
  }
  try {
    return logo.type === "png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
  } catch {
    // Image illisible : la lettre reste générée, sans logo
    return null;
  }
}

/** En-tête de l'entreprise (logo, identité, identifiants légaux) et bloc destinataire. */
async function header(w: Writer, pdf: PDFDocument, data: CoverLetterData) {
  const logo = await embedLogo(pdf, data.organization.logo);
  const top = w.y;
  let x = MARGIN;
  if (logo) {
    const scale = Math.min(110 / logo.width, 50 / logo.height, 1);
    w.page.drawImage(logo, { x: MARGIN, y: top - logo.height * scale, width: logo.width * scale, height: logo.height * scale });
    x = MARGIN + logo.width * scale + 12;
  }
  const org = data.organization;
  w.y = top - 11;
  w.text(org.name, x, 12, w.bold);
  for (const line of [
    [org.address, org.city].filter(Boolean).join(", "),
    [org.phone && `Tél. ${org.phone}`, org.email].filter(Boolean).join(" · "),
    [org.ice && `ICE ${org.ice}`, org.taxId && `IF ${org.taxId}`, org.tradeRegister && `RC ${org.tradeRegister}`].filter(Boolean).join(" · "),
  ].filter(Boolean)) {
    w.y -= 11;
    w.text(line, x, 8.5, w.font, MUTED);
  }
  w.y = Math.min(w.y, top - 55) - 25;

  // Destinataire, à droite
  const right = WIDTH / 2 + 30;
  w.text(data.supplier.name, right, 11, w.bold);
  for (const line of [data.supplier.address, data.supplier.city, data.supplier.ice && `ICE ${data.supplier.ice}`].filter(Boolean) as string[]) {
    w.y -= 13;
    w.text(line, right, 10);
  }
  w.y -= 28;
  const placeDate = `${data.place ? `${data.place}, le` : "Le"} ${formatDate(data.issueDate)}`;
  w.text(placeDate, WIDTH - MARGIN - w.width(placeDate, 10), 10);
  w.y -= 14;
  w.text(`Réf. : ${data.reference}`, MARGIN, 9, w.font, MUTED);
}

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase("fr") + text.slice(1);

export function letterValues(data: CoverLetterData, rectified: boolean): LetterValues {
  const count = data.instruments.length;
  const kinds = new Set(data.instruments.map((i) => i.label.split(" ")[0]));
  const noun = kinds.size === 1 ? [...kinds][0].toLowerCase() : "paiement";
  return {
    fournisseur: data.supplier.name,
    entreprise: data.organization.name,
    lieu: data.place,
    date: formatDate(data.issueDate),
    reference: data.reference,
    factures: data.invoices.map((i) => i.number).join(", ") || "—",
    moyens: `${count} ${noun}${count > 1 && noun !== "lcn" ? "s" : ""}`.replace(/^1 lcn$/, "1 LCN").replace(/ lcn$/, " LCN"),
    total: formatMAD(data.total),
    // En milieu de phrase : sans majuscule initiale
    total_lettres: lowerFirst(amountInWords(data.total, { rectified })),
    reste_du: formatMAD(data.remaining),
    signataire: data.signer.name,
  };
}

/**
 * Lettre d'accompagnement de règlement (spec §6.4 bis), A4. Deux exemplaires : un pour
 * le fournisseur, un à conserver et à faire signer.
 */
export async function coverLetterPdf(
  data: CoverLetterData,
  template: LetterTemplate,
  { copies = 1, rectified = false }: { copies?: 1 | 2; rectified?: boolean } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Lettre d'accompagnement ${data.reference}`);
  pdf.setCreator("MesValeurs");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const values = letterValues(data, rectified);
  const labels = copies === 2 ? ["Exemplaire fournisseur", "Exemplaire à conserver"] : [""];

  for (const label of labels) {
    const w = new Writer(pdf, font, bold, label ? `${label} · ${data.reference}` : data.reference);
    await header(w, pdf, data);
    w.y -= 24;
    w.paragraph(`Objet : ${renderLetterText(template.subject, values)}`, 10.5, bold);
    w.y -= 8;
    w.paragraph(renderLetterText(template.body, values));
    w.y -= 10;

    if (data.invoices.length > 0) {
      w.paragraph("Factures réglées", 10, bold);
      w.table(
        [
          { header: "Facture", width: 140 },
          { header: "Date", width: 70 },
          { header: "Montant TTC", width: 95, align: "right" },
          { header: "Réglé", width: 95, align: "right" },
          { header: "Reste dû", width: 95, align: "right" },
        ],
        data.invoices.map((i) => [i.number, formatDate(i.issueDate), formatMAD(i.amountInclTax), formatMAD(i.settled), formatMAD(i.remaining)]),
      );
    }
    w.paragraph("Paiements joints", 10, bold);
    w.table(
      [
        { header: "Moyen", width: 150 },
        { header: "Banque", width: 150 },
        { header: "Échéance", width: 90 },
        { header: "Montant", width: 105, align: "right" },
      ],
      data.instruments.map((i) => [i.label, i.bank, i.dueDate ? formatDate(i.dueDate) : "—", formatMAD(i.amount)]),
      ["Total réglé", "", "", formatMAD(data.total)],
    );
    w.paragraph(`Arrêté le présent règlement à la somme de : ${values.total_lettres}.`, 9.5);
    if (data.remaining > 0) {
      w.y -= 2;
      w.paragraph(`Reste à payer sur ces factures après ce règlement : ${formatMAD(data.remaining)}.`, 9.5, bold);
    }
    w.y -= 8;
    w.paragraph(renderLetterText(template.closing, values));

    // Signature et cachet, à droite ; « Reçu par » (accusé de réception papier), à gauche
    w.ensure(120);
    w.y -= 24;
    const boxWidth = (WIDTH - 2 * MARGIN - 20) / 2;
    w.box(MARGIN, boxWidth, 90, "Reçu par (nom, date et signature)");
    w.box(MARGIN + boxWidth + 20, boxWidth, 90, `${data.signer.name}${data.signer.jobTitle ? ` — ${data.signer.jobTitle}` : ""}`);
    const keep = w.y;
    w.y -= 26;
    w.text("Signature et cachet", MARGIN + boxWidth + 26, 8.5, font, MUTED);
    w.y = keep - 26;
    w.text("Nom :", MARGIN + 6, 8.5, font, MUTED);
    w.y -= 16;
    w.text("Date :", MARGIN + 6, 8.5, font, MUTED);
    w.y = keep - 90;
  }
  return pdf.save();
}

/**
 * Bordereau de remise des chèques et LCN au fournisseur (ou à son coursier) : liste des
 * valeurs remises et accusé de réception signé. Deux exemplaires sur la page.
 */
export async function remittanceSlipPdf(data: CoverLetterData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Bordereau de remise ${data.reference}`);
  pdf.setCreator("MesValeurs");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(pdf, font, bold, data.reference);

  for (const label of ["Exemplaire fournisseur", "Exemplaire à conserver"]) {
    w.y -= label === "Exemplaire fournisseur" ? 0 : 10;
    w.text("Bordereau de remise de valeurs", MARGIN, 12, bold);
    const tag = `${label} · ${data.reference}`;
    w.text(tag, WIDTH - MARGIN - w.width(tag, 8.5), 8.5, font, MUTED);
    w.y -= 14;
    w.text(data.organization.name, MARGIN, 10, bold);
    w.y -= 14;
    w.text(`Remis à : ${data.supplier.name}${data.supplier.city ? ` (${data.supplier.city})` : ""}`, MARGIN, 10);
    w.y -= 14;
    w.text(`Émis le ${formatDate(data.issueDate)}${data.place ? ` à ${data.place}` : ""}`, MARGIN, 10);
    w.y -= 6;
    w.table(
      [
        { header: "Moyen", width: 150 },
        { header: "Banque", width: 150 },
        { header: "Échéance", width: 90 },
        { header: "Montant", width: 105, align: "right" },
      ],
      data.instruments.map((i) => [i.label, i.bank, i.dueDate ? formatDate(i.dueDate) : "—", formatMAD(i.amount)]),
      [`${data.instruments.length} valeur${data.instruments.length > 1 ? "s" : ""}`, "", "", formatMAD(data.total)],
    );
    w.paragraph("Je soussigné(e) reconnais avoir reçu les valeurs ci-dessus.", 9.5);
    w.y -= 18;
    w.text("Nom :", MARGIN, 9.5);
    w.text("CIN (facultatif) :", MARGIN + 200, 9.5);
    w.y -= 22;
    w.text("Date et heure :", MARGIN, 9.5);
    w.text("Signature :", MARGIN + 200, 9.5);
    w.y -= 40;
    w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: WIDTH - MARGIN, y: w.y }, thickness: 0.5, color: MUTED, dashArray: [4, 3] });
    w.y -= 24;
  }
  return pdf.save();
}
