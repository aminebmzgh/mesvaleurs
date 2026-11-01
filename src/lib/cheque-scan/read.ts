import { createCanvas, createOcrWorker, imageCanvas } from "@/lib/ocr/worker";
import { type ChequeReading, readCheque } from "./parse";

export type ChequeScan = ChequeReading & { lcn: boolean };

/**
 * Lecture, dans le navigateur, de la photo du premier chèque ou de la première LCN d'un
 * carnet : texte complet de la formule, puis bande CMC7 (bas de la formule) relue seule,
 * en chiffres uniquement.
 */
export async function readChequePhoto(file: File, accountRib: string | null, onProgress?: (ratio: number) => void): Promise<ChequeScan> {
  const canvas = await imageCanvas(file, 1600, 2400);
  if (!canvas) {
    throw new Error("Image illisible : prenez une photo au format JPEG ou PNG.");
  }
  const { PSM } = await import("tesseract.js");
  let pass = 0;
  const worker = await createOcrWorker((ratio) => onProgress?.((pass + ratio) / 2));
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data: page } = await worker.recognize(canvas);
    pass = 1;
    // Bande : lignes gardées entières, chiffres seulement
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, tessedit_char_whitelist: "0123456789" });
    const { data: band } = await worker.recognize(bottomBand(canvas));
    return { ...readCheque(page.text, band.text, accountRib), lcn: /lettre\s+de\s+change|\bLCN\b/i.test(page.text) };
  } finally {
    await worker.terminate();
  }
}

/** Quart inférieur de la photo (bande CMC7), agrandi. */
function bottomBand(source: HTMLCanvasElement): HTMLCanvasElement {
  const top = Math.round(source.height * 0.72);
  const height = source.height - top;
  const band = createCanvas(source.width * 1.5, height * 1.5);
  band.getContext("2d")!.drawImage(source, 0, top, source.width, height, 0, 0, band.width, band.height);
  return band;
}
