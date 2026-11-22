/** Textes des e-mails qui donnent au fournisseur le lien de son portail de suivi (#48). */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Paragraphe HTML ; un lien de portail devient cliquable. */
function htmlLine(line: string, url: string | null): string {
  if (!line) {
    return "";
  }
  const escaped = escapeHtml(line);
  if (url && line.includes(url)) {
    const safeUrl = escapeHtml(url);
    return `<p>${escaped.replace(safeUrl, `<a href="${safeUrl}">${safeUrl}</a>`)}</p>`;
  }
  return `<p>${escaped}</p>`;
}

export function linesToHtml(lines: string[], url: string | null = null): string {
  return lines.map((line) => htmlLine(line, url)).join("");
}

/** Lignes à ajouter à un e-mail envoyé au fournisseur (accusé de réception…) quand un lien est actif. */
export function portalLinkLines(url: string | null): string[] {
  return url ? [``, `Suivez à tout moment vos règlements et vos factures en attente : ${url}`] : [];
}

/** E-mail d'envoi du lien du portail. */
export function portalEmail({ organizationName, supplierName, url }: { organizationName: string; supplierName: string; url: string }) {
  const lines = [
    `Bonjour,`,
    ``,
    `${organizationName} met à la disposition de ${supplierName} un suivi en ligne de ses règlements : chèques, LCN et virements émis à votre nom, leur état (prêt, remis, encaissé) et vos factures en attente de règlement.`,
    ``,
    `Votre lien personnel : ${url}`,
    ``,
    `Ce lien ne demande ni compte ni mot de passe : gardez-le pour vous.`,
    ``,
    `Cordialement,`,
    organizationName,
  ];
  return {
    subject: `Suivi de vos règlements — ${organizationName}`,
    text: lines.join("\n"),
    html: linesToHtml(lines, url),
  };
}
