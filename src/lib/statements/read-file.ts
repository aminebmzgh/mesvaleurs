import { normalizeLabel } from "./extract";
import type { Cell } from "./parse";

/**
 * Lecture d'un relevé dans le navigateur (SheetJS chargé à la demande).
 * CSV : décodé en UTF-8, sinon en Windows-1252, et lu en texte brut, pour que
 * « 03/10/2026 » ne soit pas interprété à l'américaine (3 octobre, pas 10 mars).
 */
export async function readStatementFile(file: File): Promise<{ rows: Cell[][]; format: "csv" | "excel"; hash: string }> {
  const buffer = await file.arrayBuffer();
  const hash = await sha256Hex(buffer);
  const XLSX = await import("xlsx");
  const isCsv = /\.(csv|txt)$/i.test(file.name) || file.type === "text/csv";

  const workbook = isCsv
    ? XLSX.read(decodeText(buffer), { type: "string", raw: true })
    : XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error("Le fichier ne contient aucune feuille.");
  }
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null, blankrows: false });
  return { rows, format: isCsv ? "csv" : "excel", hash };
}

function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Signature d'un en-tête : reconnaît le même format d'export d'un relevé à l'autre. */
export function headerSignature(headers: Cell[]): string {
  return headers.map((cell) => normalizeLabel(cell === null || cell === undefined ? "" : String(cell))).join("|");
}
