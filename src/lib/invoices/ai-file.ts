import { createCanvas, imageCanvas } from "@/lib/ocr/worker";

/**
 * Préparation d'une facture pour la lecture par IA, dans le navigateur : le texte d'un
 * PDF (le serveur en masque les données personnelles), sinon les premières pages ou la
 * photo, réduites en JPEG. Seul ce contenu est envoyé, pas le fichier d'origine.
 */
export type AiDocument = { text: string } | { images: string[] };

/** Pages lues au plus (factures de plusieurs pages : totaux en dernière page rarement au-delà). */
const MAX_PAGES = 3;
/** En deçà, le PDF est un scan : ses pages partent en image. */
const MIN_TEXT_LENGTH = 100;
/** Largeur des images envoyées : lisible par le modèle, légère à transmettre. */
const IMAGE_WIDTH = 1600;
/** Taille maximale d'une image (data URL) : trois images restent sous la limite des actions serveur (4 Mo). */
const MAX_IMAGE_LENGTH = 1_200_000;

export const AI_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export class AiFileError extends Error {}

export async function prepareInvoiceForAi(file: File): Promise<AiDocument> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return preparePdf(await file.arrayBuffer());
  }
  const canvas = await imageCanvas(file, 800, IMAGE_WIDTH);
  if (!canvas) {
    throw new AiFileError("Image illisible : choisissez une photo JPEG ou PNG, ou un PDF.");
  }
  return { images: [toJpeg(canvas)] };
}

async function preparePdf(buffer: ArrayBuffer): Promise<AiDocument> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const loading = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  let pdf;
  try {
    pdf = await loading.promise;
  } catch {
    await loading.destroy();
    throw new AiFileError("PDF illisible ou protégé par un mot de passe.");
  }
  try {
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    const texts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      texts.push(content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")).join(""));
      page.cleanup();
    }
    const text = texts.join("\n\n").replace(/[ \t]+/g, " ").trim();
    if (text.length >= MIN_TEXT_LENGTH) {
      return { text: text.slice(0, 30_000) };
    }
    // Scan : pages rendues en image
    const images: string[] = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: IMAGE_WIDTH / base.width });
      const canvas = createCanvas(viewport.width, viewport.height);
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      images.push(toJpeg(canvas));
      page.cleanup();
    }
    return { images };
  } finally {
    await loading.destroy();
  }
}

function toJpeg(canvas: HTMLCanvasElement): string {
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_IMAGE_LENGTH) {
      return url;
    }
  }
  throw new AiFileError("Image trop détaillée : réduisez-la ou envoyez un PDF.");
}
