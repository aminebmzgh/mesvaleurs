/**
 * Markdown réduit des réponses de l'assistant : paragraphes, listes, gras et liens vers
 * les écrans de l'application. Rendu en éléments React (jamais de HTML injecté) ; un lien
 * externe ou suspect reste du texte.
 */
export type Inline = { type: "text"; text: string } | { type: "strong"; text: string } | { type: "link"; text: string; href: string };
export type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] };

/** Chemin interne de l'application : « /factures/… », sans protocole ni « // ». */
export function isInternalPath(href: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9\-._~/?#=&%+]*$/.test(href);
}

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) {
      parts.push({ type: "text", text: text.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      parts.push({ type: "strong", text: match[1] });
    } else if (isInternalPath(match[3])) {
      parts.push({ type: "link", text: match[2], href: match[3] });
    } else {
      parts.push({ type: "text", text: match[2] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", text: text.slice(last) });
  }
  return parts;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/;

function tableCells(line: string): string[] {
  return line.trim().slice(1, -1).split("|").map((cell) => cell.trim());
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  for (const raw of source.replace(/\r/g, "").split("\n")) {
    // Titres : simple texte en gras
    const line = raw.replace(/^\s*#{1,6}\s+(.*)$/, "**$1**");
    const bullet = line.match(BULLET);
    const numbered = bullet ? null : line.match(NUMBERED);
    if (TABLE_ROW.test(line)) {
      flush();
      const cells = tableCells(line);
      const previous = blocks.at(-1);
      if (TABLE_SEPARATOR.test(line)) {
        // Ligne « |---|---| » : les lignes précédentes étaient l'en-tête
        if (previous?.type === "table" && previous.rows.length === 0) {
          continue;
        }
      } else if (previous?.type === "table") {
        previous.rows.push(cells.map(parseInline));
      } else {
        blocks.push({ type: "table", header: cells.map(parseInline), rows: [] });
      }
    } else if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered);
      const item = parseInline((bullet ?? numbered)![1]);
      const previous = blocks.at(-1);
      if (previous?.type === "list" && previous.ordered === ordered) {
        previous.items.push(item);
      } else {
        blocks.push({ type: "list", ordered, items: [item] });
      }
    } else if (line.trim() === "") {
      flush();
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}
