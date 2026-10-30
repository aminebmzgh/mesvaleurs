/**
 * Lecture du premier chèque (ou de la première LCN) d'un carnet : numéro de formule et
 * compte, d'après le texte reconnu par OCR. Deux sources se recoupent : le numéro et le
 * RIB imprimés en clair, et la bande CMC7 en bas de la formule (numéro en tête de bande,
 * puis codes banque, localité et compte). La police CMC7, en bâtonnets, est mal reconnue :
 * le texte en clair prime en cas de désaccord, et la lecture est toujours à confirmer.
 */
import { isValidRib, normalizeRib } from "@/lib/rib";

/** Largeurs plausibles d'un numéro de formule. */
const NUMBER = /^\d{6,8}$/;

export type ChequeReading = {
  /** Premier numéro proposé, zéros initiaux compris. */
  number: string | null;
  /** « both » : texte en clair et bande CMC7 concordants. */
  source: "both" | "printed" | "cmc7" | null;
  /** Désaccord entre les deux lectures : le numéro imprimé est proposé, à vérifier. */
  conflict: { printed: string; cmc7: string } | null;
  /** Le chèque appartient-il au compte du carnet ? */
  account: "match" | "mismatch" | "unknown";
};

/** Confusions habituelles de l'OCR dans une suite de chiffres. */
const DIGIT_LOOKALIKES: Record<string, string> = { O: "0", o: "0", D: "0", Q: "0", I: "1", l: "1", "|": "1", "!": "1", S: "5", s: "5", B: "8", Z: "2", z: "2", G: "6" };

/** Remplace les lettres prises pour des chiffres dans les suites qui comptent au moins un chiffre. */
export function normalizeDigits(text: string): string {
  return text.replace(/[0-9OoDQIl|!SsBZzG]{4,}/g, (word) =>
    /\d/.test(word) ? word.replace(/[^0-9]/g, (char) => DIGIT_LOOKALIKES[char] ?? char) : word,
  );
}

/** Numéro imprimé en clair : après « N° », « No » ou « série ». */
export function printedNumber(text: string): string | null {
  for (const line of normalizeDigits(text).split("\n")) {
    const match = /(?:\bN\s?[°ºo]\.?|\bno\.?|num[ée]ro|s[ée]rie)\s*:?\s*((?:\d[\s.]?){5,7}\d)(?![\s.]?\d)/i.exec(line);
    const number = match?.[1].replace(/\D/g, "");
    if (number && NUMBER.test(number)) {
      return number;
    }
  }
  return null;
}

/** Ligne de la bande CMC7 : celle qui compte le plus de chiffres (une trentaine, 20 au moins). */
export function cmc7Line(band: string): string | null {
  let best: string | null = null;
  let bestCount = 19;
  for (const line of normalizeDigits(band).split("\n")) {
    const count = (line.match(/\d/g) ?? []).length;
    if (count > bestCount) {
      best = line;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Numéro en tête de la bande CMC7. Groupes parfois lus sans séparateur : la bande
 * concorde alors avec le numéro imprimé si elle commence par lui.
 */
export function cmc7Number(band: string, printed: string | null = null): string | null {
  const line = cmc7Line(band);
  if (!line) {
    return null;
  }
  const first = line.match(/\d+/)![0];
  if (NUMBER.test(first)) {
    return first;
  }
  return printed && line.replace(/\D/g, "").startsWith(printed) ? printed : null;
}

/** RIB imprimés en clair (24 chiffres, éventuellement par blocs), clé vérifiée. */
export function printedRibs(text: string): string[] {
  const ribs = new Set<string>();
  for (const line of normalizeDigits(text).split("\n")) {
    for (const run of line.match(/\d[\d\s.-]{22,40}\d/g) ?? []) {
      const digits = normalizeRib(run);
      for (let start = 0; start + 24 <= digits.length; start += 1) {
        if (isValidRib(digits.slice(start, start + 24))) {
          ribs.add(digits.slice(start, start + 24));
        }
      }
    }
  }
  return [...ribs];
}

export function readCheque(text: string, band: string, accountRib: string | null): ChequeReading {
  const printed = printedNumber(text);
  const cmc7 = cmc7Number(band, printed);
  const number = printed ?? cmc7;
  const source = printed && cmc7 ? (printed === cmc7 ? "both" : "printed") : printed ? "printed" : cmc7 ? "cmc7" : null;

  let account: ChequeReading["account"] = "unknown";
  if (accountRib) {
    const rib = normalizeRib(accountRib);
    const ribs = printedRibs(text);
    // Bande CMC7 : le numéro de compte (16 chiffres du RIB) y figure
    const digits = `${normalizeDigits(text)}\n${normalizeDigits(band)}`.replace(/\D/g, "");
    if (ribs.includes(rib) || digits.includes(rib.slice(6, 22))) {
      account = "match";
    } else if (ribs.length > 0) {
      account = "mismatch";
    }
  }
  return {
    number,
    source,
    conflict: printed && cmc7 && printed !== cmc7 ? { printed, cmc7 } : null,
    account,
  };
}

/** Dernier numéro d'un carnet de `size` formules, à la largeur du premier (zéros initiaux). */
export function lastNumberOf(first: string, size: number): string | null {
  const value = first.trim();
  if (!/^\d{1,12}$/.test(value) || size < 1) {
    return null;
  }
  const last = String(Number(value) + size - 1);
  return last.length > value.length ? last : last.padStart(value.length, "0");
}
