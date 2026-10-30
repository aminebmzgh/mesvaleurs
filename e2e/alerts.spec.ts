import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const CRON_SECRET = "e2e-cron-secret-0123456789";
const today = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

test("tâche planifiée : protégée par le secret, rejouable sans doublon", async ({ request }) => {
  expect((await request.get("/api/cron/alertes")).status()).toBe(401);
  expect((await request.get("/api/cron/alertes", { headers: { Authorization: "Bearer mauvais-secret" } })).status()).toBe(401);

  const headers = { Authorization: `Bearer ${CRON_SECRET}` };
  const first = await request.get("/api/cron/alertes", { headers });
  expect(first.status()).toBe(200);
  const body = await first.json();
  expect(body.organizations).toBeGreaterThanOrEqual(2);

  // Deuxième appel du jour : toutes les entreprises déjà traitées
  const second = await (await request.get("/api/cron/alertes", { headers })).json();
  expect(second.summary).toEqual({ skipped: second.organizations });
});

test("page Alertes : alertes en cours, préférence e-mail et historique des envois", async ({ page, request }) => {
  await request.get("/api/cron/alertes", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  await login(page, "gestionnaire@demo.ma");
  await page.getByRole("link", { name: "Alertes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Alertes", exact: true })).toBeVisible();

  // Factures non soldées du seed : proches de leur date limite légale, ou en retard selon le jour
  const alerts = page.getByRole("list", { name: "Alertes en cours" });
  const invoiceAlert = alerts.getByRole("listitem").filter({ hasText: /factures? (en retard|à payer sous 7 jours)/ }).first();
  await expect(invoiceAlert).toBeVisible();
  await expect(invoiceAlert.getByRole("link", { name: /Voir les factures|Préparer un paiement/ })).toHaveAttribute("href", /^\/(factures|paiements\/nouveau)$/);

  // Envoi non configuré en test : signalé, et tracé dans l'historique du jour
  await expect(page.getByText(/L'envoi des e-mails n'est pas encore activé/)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: today }).getByText("Envoi non configuré")).toBeVisible();

  const checkbox = page.getByLabel("Recevoir le récapitulatif des alertes chaque matin");
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Vous ne recevrez plus le récapitulatif par e-mail.")).toBeVisible();
  await page.reload();
  await expect(checkbox).not.toBeChecked();

  // Retour à la valeur par défaut, pour les autres tests
  await checkbox.check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Vous recevrez le récapitulatif chaque matin.")).toBeVisible();
});

test("délais d'alerte des LCN et des factures réglables", async ({ page }) => {
  await login(page, "admin@demo.ma");
  await page.goto("/parametres/organisation");
  await expect(page.getByLabel("Signaler une LCN à échoir")).toHaveText(/7 jours avant/);
  await page.getByLabel("Signaler une facture à payer").click();
  await page.getByRole("option", { name: "15 jours avant", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de l'entreprise enregistrées.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Signaler une facture à payer")).toHaveText(/15 jours avant/);

  // Retour à la valeur par défaut
  await page.getByLabel("Signaler une facture à payer").click();
  await page.getByRole("option", { name: "7 jours avant", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de l'entreprise enregistrées.")).toBeVisible();
});
