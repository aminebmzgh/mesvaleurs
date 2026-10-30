/**
 * Moteur OCR (Tesseract, français) exécuté dans le navigateur. Worker, moteur
 * WebAssembly et modèle de langue sont servis par l'application (copiés dans
 * public/ocr par scripts/ocr-assets.mjs) : aucune image n'est envoyée à un tiers.
 */
import type { Worker } from "tesseract.js";

/** Fichiers de Tesseract servis par l'application. */
export const OCR_ASSETS_PATH = "/ocr";

export async function createOcrWorker(onProgress?: (ratio: number) => void): Promise<Worker> {
  const { createWorker, OEM } = await import("tesseract.js");
  const base = new URL(OCR_ASSETS_PATH, window.location.origin).href;
  return createWorker("fra", OEM.LSTM_ONLY, {
    workerPath: `${base}/worker.min.js`,
    corePath: base,
    langPath: base,
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress?.(message.progress);
      }
    },
  });
}

/** Image ou photo : orientation de l'appareil respectée, ramenée à une largeur lisible par l'OCR. */
export async function imageCanvas(file: File, minWidth: number, maxWidth: number): Promise<HTMLCanvasElement | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const width = Math.min(maxWidth, Math.max(minWidth, bitmap.width));
  const canvas = createCanvas(width, bitmap.height * (width / bitmap.width));
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  return canvas;
}
