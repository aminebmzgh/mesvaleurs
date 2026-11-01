import type { StatementTable } from "../pdf/layout";
import { PdfStatementError } from "../pdf/parsers";
import { createCanvas, createOcrWorker, imageCanvas } from "@/lib/ocr/worker";
import { itemsFromOcr, tableFromOcr } from "./items";

/** Largeur des pages envoyées à Tesseract : environ 300 ppp pour une page A4. */
const TARGET_WIDTH = 2480;
const MIN_WIDTH = 1600;
const MAX_WIDTH = 3200;
/** Au-delà, l'OCR dans le navigateur devient trop long : découper le relevé. */
export const MAX_OCR_PAGES = 20;

export type OcrProgress = { page: number; pages: number; ratio: number };
/** Relevé lu par OCR, avec l'image de chaque page (URL locales, à libérer). */
export type ScannedStatement = StatementTable & { pages: string[] };

/**
 * Lecture OCR d'un relevé scanné (PDF sans texte) ou photographié, entièrement dans le
 * navigateur : le relevé n'est envoyé à aucun service tiers et le modèle de langue
 * française est servi par l'application.
 */
export async function readScannedStatement(
  file: File,
  buffer: ArrayBuffer,
  onProgress?: (progress: OcrProgress) => void,
): Promise<ScannedStatement> {
  const canvases = /\.pdf$/i.test(file.name) || file.type === "application/pdf" ? await renderPdf(buffer) : [await renderImage(file)];
  const { PSM } = await import("tesseract.js");
  let current = 1;
  const worker = await createOcrWorker((ratio) => onProgress?.({ page: current, pages: canvases.length, ratio }));
  try {
    // Tableau : un seul bloc de texte, lignes complètes de la page
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1", user_defined_dpi: "300" });
    const items = [];
    for (const [index, canvas] of canvases.entries()) {
      current = index + 1;
      onProgress?.({ page: current, pages: canvases.length, ratio: 0 });
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      items.push(...itemsFromOcr(data.blocks, current, canvas.width));
    }
    const table = tableFromOcr(items);
    const pages = await Promise.all(canvases.map(pageImage));
    return { ...table, pages };
  } finally {
    await worker.terminate();
  }
}

async function renderPdf(buffer: ArrayBuffer): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const loading = pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) });
  const pdf = await loading.promise;
  try {
    if (pdf.numPages > MAX_OCR_PAGES) {
      throw new PdfStatementError("unreadable", `Plus de ${MAX_OCR_PAGES} pages scannées : importez le relevé par période plus courte.`);
    }
    const canvases: HTMLCanvasElement[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
      const canvas = createCanvas(viewport.width, viewport.height);
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      canvases.push(canvas);
      page.cleanup();
    }
    return canvases;
  } finally {
    await loading.destroy();
  }
}

async function renderImage(file: File): Promise<HTMLCanvasElement> {
  const canvas = await imageCanvas(file, MIN_WIDTH, MAX_WIDTH);
  if (!canvas) {
    throw new PdfStatementError("unreadable", "Image illisible : importez une photo au format JPEG ou PNG.");
  }
  return canvas;
}

/** Image de la page pour l'écran de vérification (JPEG, plus léger que le canevas). */
function pageImage(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/jpeg", 0.8)), "image/jpeg", 0.8);
  });
}
