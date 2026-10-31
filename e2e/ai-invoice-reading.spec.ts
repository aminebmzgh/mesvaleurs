import { expect, type Page, test } from "@playwright/test";
import { textPdf } from "./fixtures/text-pdf";
import { login, uniqueSuffix } from "./helpers";

/**
 * Lecture des factures par IA, contre le faux service OpenRouter (e2e/fixtures/openrouter-mock.mjs) :
 * il « lit » les lignes « clé: valeur » des PDF fabriqués ici.
 */
const AI_MOCK_URL = "http://localhost:3101";

const invoicePdf = (fields: Record<string, string>, extra: string[] = []) =>
  textPdf(["FACTURE", ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`), ...extra]);

async function readInvoice(page: Page, name: string, pdf: Buffer) {
  await page.goto("/factures/nouvelle");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Facture", { exact: true }).setInputFiles({ name, mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByRole("status", { name: "Résultat de la lecture" })).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: "serial" });

test("IA désactivée par défaut, activée par un administrateur avec son accord", async ({ page }) => {
  await login(page, "admin@demo.ma");
  await page.goto("/parametres/organisation");
  const card = page.locator("#ia");
  const enabled = card.getByLabel("Activer la lecture des factures par IA");
  // Base rejouée : l'IA a pu être activée par un passage précédent
  if (await enabled.isChecked()) {
    await enabled.uncheck();
    await card.getByRole("button", { name: "Enregistrer les réglages de l'IA" }).click();
    await expect(card.getByText("Lecture des factures par IA désactivée.")).toBeVisible();
  }

  await page.goto("/factures/nouvelle");
  await expect(page.getByText("Lecture des factures par IA désactivée pour votre entreprise.")).toBeVisible();
  await expect(page.getByLabel("Facture", { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "L'activer dans les paramètres" }).click();
  await enabled.check();
  // Sans accord sur l'envoi hors du Maroc : refusé
  await card.getByRole("button", { name: "Enregistrer les réglages de l'IA" }).click();
  await expect(card.getByText("Acceptez l'envoi des documents au service d'IA pour l'activer.")).toBeVisible();
  await card.getByLabel(/J'accepte que les factures lues soient envoyées/).check();
  await card.getByRole("button", { name: "Enregistrer les réglages de l'IA" }).click();
  await expect(card.getByText("Lecture des factures par IA activée.")).toBeVisible();
  await expect(card.getByText(/Activée le .* par admin@demo\.ma\./)).toBeVisible();
});

test("facture PDF lue par l'IA : formulaire pré-rempli, données personnelles masquées, pièce jointe", async ({ page, request }) => {
  test.setTimeout(90_000);
  const number = `IA-${uniqueSuffix()}`;
  const pdf = invoicePdf(
    {
      supplier_name: "SOTRAMA MATERIAUX",
      supplier_ice: "001234567000089",
      customer_ice: "002345678000041",
      number,
      issue_date: "2026-10-20",
      due_date: "2026-12-19",
      currency: "MAD",
      amount_excl_tax: "10000",
      vat_amount: "2000",
      amount_incl_tax: "12000",
    },
    ["Contact : compta@sotrama.ma - Tel. 0522 11 11 11"],
  );
  await login(page, "preparateur@demo.ma");
  await readInvoice(page, "facture-sotrama.pdf", pdf);

  const result = page.getByRole("status", { name: "Résultat de la lecture" });
  await expect(result.getByText("Fournisseur reconnu : Sotrama Matériaux SARL")).toBeVisible();
  await expect(result.getByText("Le document sera joint à la facture et archivé.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Numéro de facture")).toHaveValue(number);
  await expect(page.getByLabel("Date de facture")).toHaveValue("2026-10-20");
  await expect(page.getByLabel("Délai convenu (jours)")).toHaveValue("60");
  await expect(page.getByLabel("Montant TTC (DH)")).toHaveValue(/^12\s000,00$/);

  // Le service n'a reçu ni l'e-mail ni le téléphone
  const sent = await (await request.get(`${AI_MOCK_URL}/last`)).text();
  expect(sent).toContain(number);
  expect(sent).toContain("[e-mail]");
  expect(sent).toContain("[téléphone]");
  expect(sent).not.toContain("compta@sotrama.ma");

  await page.getByRole("button", { name: "Enregistrer la facture" }).click();
  await expect(page.getByRole("heading", { name: `Facture ${number}` })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir la pièce jointe" })).toBeVisible();

  // Même facture relue : doublon signalé
  await readInvoice(page, "facture-sotrama.pdf", pdf);
  await expect(page.getByText(`Facture ${number} déjà enregistrée pour ce fournisseur.`)).toBeVisible();
});

test("fournisseur inconnu créé depuis la lecture, anomalies signalées", async ({ page }) => {
  test.setTimeout(90_000);
  const suffix = uniqueSuffix();
  const supplier = `Riad Bureautique ${suffix}`;
  const ice = `8${String(Date.now()).padStart(14, "0")}`;
  const number = `RB-${suffix}`;
  await login(page, "preparateur@demo.ma");
  await readInvoice(
    page,
    "facture-riad.pdf",
    invoicePdf({
      supplier_name: supplier,
      supplier_ice: ice,
      customer_ice: "009999999000099",
      number,
      issue_date: "2026-10-22",
      amount_excl_tax: "1000",
      vat_amount: "150",
      amount_incl_tax: "1150",
    }),
  );

  const result = page.getByRole("status", { name: "Résultat de la lecture" });
  await expect(result.getByText(`Fournisseur inconnu : « ${supplier} » (ICE ${ice})`)).toBeVisible();
  await expect(result.getByText(/Taux de TVA inhabituel \(15,00 %\)/)).toBeVisible();
  await expect(result.getByText("Facture adressée à l'ICE 009999999000099, qui n'est pas celui de votre entreprise.")).toBeVisible();

  await result.getByRole("button", { name: "Créer ce fournisseur" }).click();
  await expect(result.getByText(`Fournisseur reconnu : ${supplier}`)).toBeVisible();
  await expect(page.getByLabel("Numéro de facture")).toHaveValue(number);
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();
  await expect(page.getByRole("heading", { name: `Facture ${number}` })).toBeVisible();
  await expect(page.getByText(supplier).first()).toBeVisible();
});
