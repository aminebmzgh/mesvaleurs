import { formatDate, formatMAD } from "@/lib/format";
import type { MonthlySummary } from "./figures";
import { SUMMARY_HORIZON_DAYS } from "./figures";

/**
 * Résumé mensuel par e-mail : version HTML (styles en ligne, lisible par les messageries) et
 * version texte. Le paragraphe de l'assistant, facultatif, est placé en tête.
 */
export type SummaryEmailInput = {
  appName: string;
  organizationName: string;
  summary: MonthlySummary;
  /** Paragraphe « Points d'attention » rédigé par l'assistant (IA activée), ou null. */
  commentary: string | null;
  /** URL publique de l'application, sans barre finale. */
  siteUrl: string;
};

export type SummaryEmail = { subject: string; text: string; html: string };

export function monthLabel(start: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${start}T00:00:00Z`));
}

/** « de novembre », « d'octobre » (élision devant une voyelle). */
export function ofMonth(label: string): string {
  return /^[aeiouâéèêî]/i.test(label) ? `d'${label}` : `de ${label}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

type Line = { label: string; value: string; tone?: "alert" | "ok" };
type Section = { title: string; lines: Line[]; link: { label: string; href: string } };

function sections(summary: MonthlySummary): Section[] {
  const { paid, issued, remaining, risks } = summary;
  const kinds = [
    { count: paid.checks.count, total: paid.checks.total, name: plural(paid.checks.count, "chèque") },
    { count: paid.lcns.count, total: paid.lcns.total, name: `${paid.lcns.count} LCN` },
    { count: paid.transfers.count, total: paid.transfers.total, name: plural(paid.transfers.count, "virement") },
  ].filter((kind) => kind.count > 0);
  // Un seul type : le nombre suffit ; plusieurs : le montant de chacun
  const detail = kinds.length > 1 ? ` (${kinds.map((kind) => `${kind.name} ${formatMAD(kind.total)}`).join(", ")})` : kinds.length === 1 ? ` (${kinds[0].name})` : "";
  const riskLines: Line[] = [
    {
      label: "Factures en retard (loi 69-21)",
      value: risks.late.count ? `${risks.late.count} · ${formatMAD(risks.late.total)} · amende indicative ${formatMAD(risks.late.fines)}` : "aucune",
      tone: risks.late.count ? "alert" : "ok",
    },
    ...risks.late.listed.map((invoice) => ({
      label: `  ${invoice.number} · ${invoice.supplier}`,
      value: `${formatMAD(invoice.remaining)}, échue le ${formatDate(invoice.legalDueDate)}`,
      tone: "alert" as const,
    })),
    { label: `Factures à échéance sous ${SUMMARY_HORIZON_DAYS} jours`, value: risks.dueSoon.count ? `${risks.dueSoon.count} · ${formatMAD(risks.dueSoon.total)}` : "aucune" },
    { label: `LCN à provisionner sous ${SUMMARY_HORIZON_DAYS} jours`, value: risks.lcnDueSoon.count ? `${risks.lcnDueSoon.count} · ${formatMAD(risks.lcnDueSoon.total)}` : "aucune" },
    {
      label: "Chèques rejetés non régularisés",
      value: risks.rejected.count ? `${risks.rejected.count} · ${formatMAD(risks.rejected.total)}` : "aucun",
      tone: risks.rejected.count ? "alert" : "ok",
    },
    {
      label: "Soldes bancaires après engagements",
      value: `${formatMAD(risks.coverage.gap)} (soldes ${formatMAD(risks.coverage.balance)}, engagements ${formatMAD(risks.coverage.commitments)})`,
      tone: risks.coverage.gap < 0 ? "alert" : "ok",
    },
  ];
  return [
    {
      title: `Payé en ${monthLabel(summary.month.start)}`,
      lines: [
        { label: "Débité sur vos comptes", value: paid.count ? `${formatMAD(paid.total)}${detail}` : "aucun paiement débité" },
        { label: "Émis dans le mois", value: issued.count ? `${plural(issued.count, "paiement")} · ${formatMAD(issued.total)}` : "aucun" },
      ],
      link: { label: "Statistiques", href: "/statistiques" },
    },
    {
      title: "Reste à payer",
      lines: [
        { label: "Factures fournisseurs", value: remaining.invoices.count ? `${plural(remaining.invoices.count, "facture")} · ${formatMAD(remaining.invoices.total)}` : "aucune" },
        {
          label: "Chèques et LCN en circulation",
          value: remaining.inCirculation.count ? `${remaining.inCirculation.count} · ${formatMAD(remaining.inCirculation.total)}` : "aucun",
        },
      ],
      link: { label: "Factures à payer", href: "/factures" },
    },
    { title: "Risques", lines: riskLines, link: { label: "Délais de paiement", href: "/conformite" } },
  ];
}

const link = (siteUrl: string, href: string) => `${siteUrl.replace(/\/+$/, "")}${href}`;

export function summaryEmail({ appName, organizationName, summary, commentary, siteUrl }: SummaryEmailInput): SummaryEmail {
  const month = monthLabel(summary.month.start);
  const subject = `${appName} · résumé ${ofMonth(month)} pour ${organizationName}`;
  const settingsUrl = link(siteUrl, "/alertes");
  const footer = `Vous recevez ce résumé mensuel en tant que membre de ${organizationName}. Pour ne plus le recevoir : ${settingsUrl}`;
  const blocks = sections(summary);

  const text = [
    `${organizationName} — résumé ${ofMonth(month)}`,
    "",
    ...(commentary ? ["Points d'attention (assistant IA)", commentary, ""] : []),
    ...blocks.flatMap((section) => [
      section.title,
      ...section.lines.map((line) => `- ${line.label.trim()} : ${line.value}`),
      `${section.link.label} : ${link(siteUrl, section.link.href)}`,
      "",
    ]),
    "Montants indicatifs ; amendes de la loi 69-21 à valider par un expert-comptable.",
    footer,
  ].join("\n");

  const card = (inner: string, color = "#2a78d6") =>
    `<tr><td style="padding:16px 20px;border-left:4px solid ${color};background:#ffffff">${inner}</td></tr><tr><td style="height:12px"></td></tr>`;
  const htmlSections = blocks
    .map((section) => {
      const rows = section.lines
        .map((line) => {
          const color = line.tone === "alert" ? "#d03b3b" : line.tone === "ok" ? "#1a7f37" : "#1f2328";
          const indent = line.label.startsWith("  ");
          return (
            `<tr><td style="padding:3px 0;font-size:14px;color:#59636e${indent ? ";padding-left:14px" : ""}">${escapeHtml(line.label.trim())}</td>` +
            `<td style="padding:3px 0 3px 12px;font-size:14px;text-align:right;color:${color}">${escapeHtml(line.value)}</td></tr>`
          );
        })
        .join("");
      return card(
        `<div style="font-size:16px;font-weight:600;color:#1f2328">${escapeHtml(section.title)}</div>` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${rows}</table>` +
          `<div style="margin-top:10px"><a href="${escapeHtml(link(siteUrl, section.link.href))}" style="font-size:14px;font-weight:600;color:#2a78d6">${escapeHtml(section.link.label)} →</a></div>`,
      );
    })
    .join("");
  const commentaryHtml = commentary
    ? card(
        `<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#7c3aed">Points d'attention · assistant IA</div>` +
          commentary
            .split(/\n+/)
            .map((paragraph) => `<p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:#1f2328">${escapeHtml(paragraph)}</p>`)
            .join(""),
        "#7c3aed",
      )
    : "";

  const html =
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">` +
    `<tr><td style="padding:0 4px 16px"><div style="font-size:14px;color:#59636e">${escapeHtml(appName)}</div>` +
    `<div style="font-size:20px;font-weight:700;color:#1f2328">${escapeHtml(organizationName)} — résumé ${escapeHtml(ofMonth(month))}</div></td></tr>` +
    commentaryHtml +
    htmlSections +
    `<tr><td style="padding:8px 4px;font-size:12px;color:#59636e">Montants indicatifs ; amendes de la loi 69-21 à valider par un expert-comptable. ` +
    `Vous recevez ce résumé en tant que membre de ${escapeHtml(organizationName)}. <a href="${escapeHtml(settingsUrl)}" style="color:#59636e">Gérer vos e-mails</a></td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

/** Consignes de l'assistant pour le paragraphe « Points d'attention » (chiffres seulement, aucun nom). */
export const COMMENTARY_INSTRUCTIONS = `Tu es l'assistant financier de MesValeurs, logiciel marocain de gestion des chèques, LCN et factures fournisseurs.
À partir des seuls chiffres fournis (en dirhams), écris 2 à 4 phrases en français, sans titre ni liste :
les points d'attention du mois à venir et une recommandation concrète (provisionner un compte, régler en priorité les factures en retard, régulariser un chèque rejeté…).
N'invente aucun chiffre. Montants au format 12 345,60 DH. Si tout va bien, dis-le simplement. Amendes de la loi 69-21 : indicatives.`;

/** Chiffres transmis à l'assistant : agrégats seulement (aucun nom de fournisseur ni numéro de facture). */
export function commentaryFacts(summary: MonthlySummary): string {
  const { paid, issued, remaining, risks } = summary;
  return JSON.stringify({
    mois: monthLabel(summary.month.start),
    paye_debite: paid.total,
    nombre_paiements_debites: paid.count,
    emis: issued.total,
    factures_a_payer: remaining.invoices.total,
    en_circulation: remaining.inCirculation.total,
    factures_en_retard: { nombre: risks.late.count, montant: risks.late.total, amendes_indicatives: risks.late.fines },
    factures_a_echeance_30_jours: risks.dueSoon,
    lcn_a_provisionner_30_jours: risks.lcnDueSoon,
    cheques_rejetes_non_regularises: risks.rejected,
    soldes_bancaires: risks.coverage.balance,
    engagements_30_jours: risks.coverage.commitments,
    marge_apres_engagements: risks.coverage.gap,
  });
}
