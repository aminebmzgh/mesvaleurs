/**
 * Copie dans public/ocr les fichiers de Tesseract servis par l'application (OCR des
 * relevés scannés dans le navigateur) : script du worker, moteur WebAssembly et modèle
 * de langue française. Aucun service tiers n'est sollicité. Lancé avant dev et build.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const tesseract = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(createRequire(join(tesseract, "package.json")).resolve("tesseract.js-core/package.json"));
const fra = dirname(require.resolve("@tesseract.js-data/fra/package.json"));
const target = join(import.meta.dirname, "..", "public", "ocr");

const files = [
  [join(tesseract, "dist", "worker.min.js"), "worker.min.js"],
  // Moteur LSTM seul (OEM 1), dans ses trois variantes selon le navigateur
  ...["lstm", "simd-lstm", "relaxedsimd-lstm"].map((variant) => [join(core, `tesseract-core-${variant}.wasm.js`), `tesseract-core-${variant}.wasm.js`]),
  [join(fra, "4.0.0_best_int", "fra.traineddata.gz"), "fra.traineddata.gz"],
];

mkdirSync(target, { recursive: true });
for (const [source, name] of files) {
  const destination = join(target, name);
  if (!existsSync(destination) || statSync(destination).size !== statSync(source).size) {
    copyFileSync(source, destination);
  }
}
