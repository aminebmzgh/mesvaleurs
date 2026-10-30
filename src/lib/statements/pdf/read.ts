import type { PdfTextItem } from "./layout";
import { type PdfStatement, PdfStatementError, parsePdfStatement } from "./parsers";

/** Nombre maximal de pages lues (au-delà : découper le relevé). */
export const MAX_PDF_PAGES = 100;

/** Lecture d'un relevé PDF dans le navigateur (pdf.js chargé à la demande). */
export async function readPdfStatement(buffer: ArrayBuffer): Promise<PdfStatement> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  // Copie : pdf.js transfère le tampon au worker, l'original sert encore à l'envoi du fichier
  const loading = pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) });
  const document = await loading.promise;
  try {
    if (document.numPages > MAX_PDF_PAGES) {
      throw new PdfStatementError("unreadable", `Plus de ${MAX_PDF_PAGES} pages : téléchargez le relevé par période plus courte.`);
    }
    const items: PdfTextItem[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") {
          continue;
        }
        // Repère de la page affichée : origine en haut à gauche, rotation comprise
        const [, , c, d, x, y] = pdfjs.Util.transform(viewport.transform, item.transform);
        items.push({ text: item.str, x, y, width: item.width, height: item.height || Math.hypot(c, d), page: pageNumber });
      }
      page.cleanup();
    }
    return parsePdfStatement(items, document.numPages);
  } finally {
    await loading.destroy();
  }
}
