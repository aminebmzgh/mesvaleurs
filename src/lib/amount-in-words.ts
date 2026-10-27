import { toCents } from "./amount";

/**
 * Montant en lettres, en français, pour les chèques et les LCN :
 * 1234,56 → « Mille deux cent trente-quatre dirhams et cinquante-six centimes ».
 *
 * Règles appliquées (orthographe traditionnelle par défaut) :
 * - « et un » pour 21, 31, 41, 51, 61, et « soixante et onze » ; pas de « et » pour 81, 91 ;
 * - traits d'union entre dizaines et unités hors « et » (vingt-deux, quatre-vingt-dix) ;
 * - « cent » et « vingt » prennent un s quand ils sont multipliés et terminent le nombre
 *   (deux cents, quatre-vingts), y compris devant million et milliard, qui sont des noms
 *   (deux cents millions), mais pas devant « mille », adjectif numéral (deux cent mille) ;
 * - « mille » est invariable et jamais précédé de « un » ;
 * - million(s) et milliard(s) s'accordent ; « de dirhams » après un nombre rond de
 *   millions ou de milliards (un million de dirhams).
 * Orthographe rectifiée de 1990 (option) : traits d'union entre tous les numéraux
 * (deux-cent-trente-quatre, vingt-et-un), sauf autour de million et milliard.
 */

/** Plus grand montant pris en charge : 999 999 999 999,99 DH. */
export const MAX_AMOUNT_IN_WORDS = 999_999_999_999.99;

export type AmountInWordsOptions = {
  /** Orthographe rectifiée de 1990 (traits d'union partout). */
  rectified?: boolean;
  /** Majuscule initiale (par défaut). */
  capitalize?: boolean;
};

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
];

const TENS: Record<number, string> = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };

/**
 * Nombre de 0 à 99. `terminal` : le nombre termine l'expression ou précède un nom
 * (million, milliard, dirhams…), ce qui autorise le s de « quatre-vingts ».
 */
function below100(n: number, terminal: boolean): string {
  if (n < 17) {
    return UNITS[n];
  }
  if (n < 20) {
    return `dix-${UNITS[n - 10]}`;
  }
  const tens = Math.floor(n / 10);
  const unit = n % 10;

  if (tens === 7) {
    // 70 à 79 : soixante-dix, soixante et onze, soixante-douze…
    return unit === 1 ? "soixante et onze" : `soixante-${below100(n - 60, terminal)}`;
  }
  if (tens === 8) {
    if (unit === 0) {
      return terminal ? "quatre-vingts" : "quatre-vingt";
    }
    return `quatre-vingt-${UNITS[unit]}`;
  }
  if (tens === 9) {
    // 90 à 99 : quatre-vingt-dix, quatre-vingt-onze…
    return `quatre-vingt-${below100(n - 80, terminal)}`;
  }
  if (unit === 0) {
    return TENS[tens];
  }
  return unit === 1 ? `${TENS[tens]} et un` : `${TENS[tens]}-${UNITS[unit]}`;
}

/** Nombre de 0 à 999 (même convention `terminal`). */
function below1000(n: number, terminal: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) {
    return below100(rest, terminal);
  }
  const hundredWord = hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent${rest === 0 && terminal ? "s" : ""}`;
  return rest === 0 ? hundredWord : `${hundredWord} ${below100(rest, terminal)}`;
}

/** Nombre entier en lettres (0 à 999 999 999 999), orthographe traditionnelle. */
function integerInWords(n: number): { words: string; roundMillions: boolean } {
  if (n === 0) {
    return { words: "zéro", roundMillions: false };
  }
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (billions > 0) {
    parts.push(`${below1000(billions, true)} milliard${billions > 1 ? "s" : ""}`);
  }
  if (millions > 0) {
    parts.push(`${below1000(millions, true)} million${millions > 1 ? "s" : ""}`);
  }
  if (thousands > 0) {
    // « mille » invariable, sans « un » devant ; « deux cent mille » sans s
    parts.push(thousands === 1 ? "mille" : `${below1000(thousands, false)} mille`);
  }
  if (rest > 0) {
    parts.push(below1000(rest, true));
  }
  return {
    words: parts.join(" "),
    roundMillions: thousands === 0 && rest === 0 && (millions > 0 || billions > 0),
  };
}

/** Orthographe rectifiée : traits d'union entre numéraux, espaces autour des noms. */
function rectify(words: string): string {
  return words
    .split(/ (millions?|milliards?) ?/)
    .filter((segment) => segment !== "")
    .map((segment) => (/^(millions?|milliards?)$/.test(segment) ? segment : segment.replaceAll(" ", "-")))
    .join(" ");
}

export function amountInWords(amount: number, options: AmountInWordsOptions = {}): string {
  const { rectified = false, capitalize = true } = options;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`Montant invalide : ${amount}`);
  }
  if (amount > MAX_AMOUNT_IN_WORDS) {
    throw new RangeError(`Montant trop élevé pour être écrit en lettres : ${amount}`);
  }

  const cents = toCents(amount);
  const dirhams = Math.floor(cents / 100);
  const centimes = cents % 100;
  const spell = (words: string) => (rectified ? rectify(words) : words);

  const segments: string[] = [];
  if (dirhams > 0 || centimes === 0) {
    const { words, roundMillions } = integerInWords(dirhams);
    const unit = dirhams > 1 ? "dirhams" : "dirham";
    segments.push(`${spell(words)} ${roundMillions ? "de " : ""}${unit}`);
  }
  if (centimes > 0) {
    segments.push(`${spell(below100(centimes, true))} centime${centimes > 1 ? "s" : ""}`);
  }

  const text = segments.join(" et ");
  return capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
