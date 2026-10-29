/**
 * Récapitulatif quotidien des alertes, envoyé par e-mail : version HTML (styles en
 * ligne, lisible par les messageries) et version texte.
 */

import { formatDate } from "@/lib/format";
import type { AlertSeverity, AppAlert } from "./alerts";

/** Éléments listés au plus par alerte (la suite est sur la page Alertes). */
export const DIGEST_ITEM_LIMIT = 5;

export type DigestInput = {
  appName: string;
  organizationName: string;
  date: string;
  alerts: AppAlert[];
  /** URL publique de l'application, sans barre finale. */
  siteUrl: string;
};

export type DigestEmail = { subject: string; text: string; html: string };

const SEVERITY_LABELS: Record<AlertSeverity, string> = { critical: "Urgent", warning: "À traiter", info: "Information" };
const SEVERITY_COLORS: Record<AlertSeverity, string> = { critical: "#d03b3b", warning: "#b4690e", info: "#2a78d6" };

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const link = (siteUrl: string, href: string) => `${siteUrl.replace(/\/+$/, "")}${href}`;

export function digestEmail({ appName, organizationName, date, alerts, siteUrl }: DigestInput): DigestEmail {
  const count = alerts.length;
  const subject = `${appName} · ${count} alerte${count > 1 ? "s" : ""} pour ${organizationName} — ${formatDate(date)}`;
  const settingsUrl = link(siteUrl, "/alertes");
  const footer = `Vous recevez ce récapitulatif en tant que membre de ${organizationName}. Pour ne plus le recevoir : ${settingsUrl}`;

  const text = [
    `${organizationName} — alertes du ${formatDate(date)}`,
    "",
    ...alerts.flatMap((alert) => [
      `[${SEVERITY_LABELS[alert.severity]}] ${alert.title}`,
      ...(alert.detail ? [alert.detail] : []),
      ...alert.items.slice(0, DIGEST_ITEM_LIMIT).map((item) => `  - ${item.label} : ${item.detail}${item.badge ? ` (${item.badge})` : ""}`),
      ...(alert.items.length > DIGEST_ITEM_LIMIT ? [`  … et ${alert.items.length - DIGEST_ITEM_LIMIT} autre(s)`] : []),
      `${alert.action} : ${link(siteUrl, alert.href)}`,
      "",
    ]),
    footer,
  ].join("\n");

  const sections = alerts
    .map((alert) => {
      const color = SEVERITY_COLORS[alert.severity];
      const items = alert.items
        .slice(0, DIGEST_ITEM_LIMIT)
        .map(
          (item) =>
            `<tr><td style="padding:4px 0;font-size:14px;color:#1f2328"><strong>${escapeHtml(item.label)}</strong> · ${escapeHtml(item.detail)}</td>` +
            `<td style="padding:4px 0 4px 12px;font-size:13px;white-space:nowrap;text-align:right;color:${item.overdue ? "#d03b3b" : "#59636e"}">${escapeHtml(item.badge ?? "")}</td></tr>`,
        )
        .join("");
      const more =
        alert.items.length > DIGEST_ITEM_LIMIT
          ? `<tr><td colspan="2" style="padding:4px 0;font-size:13px;color:#59636e">… et ${alert.items.length - DIGEST_ITEM_LIMIT} autre(s)</td></tr>`
          : "";
      return (
        `<tr><td style="padding:16px 20px;border-left:4px solid ${color};background:#ffffff">` +
        `<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:${color}">${SEVERITY_LABELS[alert.severity]}</div>` +
        `<div style="margin-top:4px;font-size:16px;font-weight:600;color:#1f2328">${escapeHtml(alert.title)}</div>` +
        (alert.detail ? `<div style="margin-top:4px;font-size:14px;color:#59636e">${escapeHtml(alert.detail)}</div>` : "") +
        (items || more ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${items}${more}</table>` : "") +
        `<div style="margin-top:10px"><a href="${escapeHtml(link(siteUrl, alert.href))}" style="font-size:14px;font-weight:600;color:#2a78d6">${escapeHtml(alert.action)} →</a></div>` +
        `</td></tr><tr><td style="height:12px"></td></tr>`
      );
    })
    .join("");

  const html =
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">` +
    `<tr><td style="padding:0 4px 16px"><div style="font-size:14px;color:#59636e">${escapeHtml(appName)}</div>` +
    `<div style="font-size:20px;font-weight:700;color:#1f2328">${escapeHtml(organizationName)} — alertes du ${formatDate(date)}</div></td></tr>` +
    sections +
    `<tr><td style="padding:8px 4px;font-size:12px;color:#59636e">Vous recevez ce récapitulatif en tant que membre de ${escapeHtml(organizationName)}. ` +
    `<a href="${escapeHtml(settingsUrl)}" style="color:#59636e">Gérer vos alertes</a></td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { subject, text, html };
}
