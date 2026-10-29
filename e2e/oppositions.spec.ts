import { expect, type Page, test } from "@playwright/test";
import { confirmFundsIfNeeded, login, uniqueSuffix } from "./helpers";

/** Le lien mène à un PDF généré. */
async function expectPdf(page: Page, href: string | null) {
  expect(href).toBeTruthy();
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
}

test("faire opposition sur un chèque émis et générer la lettre à la banque", async ({ page }) => {
  const invoice = `OPP-${uniqueSuffix()}`;
  await login(page, "gestionnaire@demo.ma");

  // Chèque émis pour l'occasion : les autres tests gardent les paiements du seed intacts
  await page.goto("/paiements/nouveau");
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Bureau Pro Fournitures" });
  await page.getByRole("button", { name: "Saisir une nouvelle facture" }).click();
  await page.getByLabel("Numéro de facture").fill(invoice);
  await page.getByLabel("Montant TTC (DH)").fill("1 500,00");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(`Facture ${invoice} enregistrée.`)).toBeVisible();
  for (const checkbox of await page.getByRole("checkbox", { name: /^Régler la facture / }).all()) {
    if ((await checkbox.getAttribute("aria-label")) !== `Régler la facture ${invoice}` && (await checkbox.isChecked())) {
      await checkbox.uncheck();
    }
  }
  page.once("dialog", (dialog) => dialog.accept());
  await confirmFundsIfNeeded(page);
  await page.getByRole("button", { name: "Émettre 1 chèque" }).click();
  await expect(page.getByText("Numéros attribués")).toBeVisible();
  const number = (await page.getByRole("row").nth(1).getByRole("cell").first().innerText()).trim();

  await page.goto(`/paiements?numero=${Number(number)}`);
  const row = page.getByRole("row").filter({ hasText: number }).first();
  await row.getByRole("button", { name: "Opposition" }).click();

  await page.getByLabel("Motif").selectOption("stolen");
  await page.getByLabel("Récépissé de déclaration (facultatif)").fill("PV n° 42/2026");
  await page.getByRole("button", { name: "Enregistrer l'opposition" }).click();
  await expect(page.getByText("Opposition enregistrée. Confirmez-la par écrit à la banque.")).toBeVisible();

  // La facture réglée par le chèque redevient à payer
  await page.goto(`/factures?q=${invoice}`);
  await expect(page.getByRole("row").filter({ hasText: invoice }).getByText("Non payée")).toBeVisible();

  // Le chèque sort de la circulation : il figure parmi les paiements en opposition
  await page.goto(`/paiements?statut=stopped&numero=${Number(number)}`);
  const stopped = page.getByRole("row").filter({ hasText: number }).first();
  await expect(stopped.getByText("En opposition")).toBeVisible();
  await expect(stopped.getByText(/^Vol constaté\(e\) le /)).toBeVisible();
  await expectPdf(page, await stopped.getByRole("link", { name: "Lettre d'opposition" }).getAttribute("href"));

  await page.goto("/journal?action=stop");
  await expect(page.getByRole("row").filter({ hasText: number }).first()).toBeVisible();
});

test("faire opposition sur une formule vierge : le numéro n'est plus attribué", async ({ page }) => {
  await login(page, "souss@demo.ma");
  await page.goto("/comptes-bancaires");
  await page.getByRole("link", { name: "Compte courant" }).click();
  await page.getByRole("button", { name: "Opposition sur formules vierges" }).click();

  // Prochaine formule vierge du chéquier
  const range = await page.getByText(/^Formules non utilisées : n° /).innerText();
  const next = range.match(/n° (\d+) à/)![1];
  await page.getByLabel("Du n°").fill(next);
  await page.getByLabel("Au n°").fill(next);
  await page.getByRole("button", { name: "Enregistrer l'opposition" }).click();
  await expect(page.getByText("Opposition enregistrée. Confirmez-la par écrit à la banque.")).toBeVisible();

  const stop = page.getByRole("row").filter({ hasText: `Formules vierges n° ${next}` });
  await expect(stop).toBeVisible();
  await expectPdf(page, await stop.getByRole("link", { name: "PDF" }).getAttribute("href"));
  // Le prochain numéro du chéquier a sauté la formule en opposition
  await expect(page.getByRole("row").filter({ hasText: "en opposition" }).getByText(String(Number(next) + 1).padStart(next.length, "0"))).toBeVisible();
});

test("courriers types : demande de prorogation, demande de relevé, relance", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");

  // Demande de prorogation, depuis le report d'une LCN (avant l'accord du fournisseur)
  await page.goto("/paiements?numero=5000101&statut=all");
  await page.getByRole("row").filter({ hasText: "5000101" }).getByRole("button", { name: "Reporter" }).click();
  await expectPdf(page, await page.getByRole("link", { name: "Demande de prorogation (PDF)" }).getAttribute("href"));
  await page.keyboard.press("Escape");

  // Demande de relevé de compte, depuis la fiche fournisseur
  await page.goto("/fournisseurs");
  await page.getByRole("link", { name: "Sotrama Matériaux SARL" }).click();
  await page.getByRole("button", { name: "Demande de relevé" }).click();
  await expectPdf(page, await page.getByRole("link", { name: "Ouvrir le PDF" }).getAttribute("href"));
  await page.keyboard.press("Escape");

  // Relance d'un client, depuis la bibliothèque de courriers types
  await page.getByRole("link", { name: "Courriers types" }).click();
  await expect(page.getByText("Lettre d'opposition")).toBeVisible();
  await expect(page.getByLabel("Client")).toBeVisible();
  await expectPdf(
    page,
    `/courriers/relance?${new URLSearchParams({ customer: "Comptoir du Nord", address: "Rabat", invoices: "la facture n° V-114", amount: "12 000,00", deadline: "2026-12-31" })}`,
  );
  expect((await page.request.get("/courriers/relance?customer=X")).status()).toBe(400);
});

test("modèle d'opposition de l'entreprise", async ({ page }) => {
  await login(page, "gestionnaire@demo.ma");
  await page.goto("/parametres/lettres");
  await page.getByRole("link", { name: "Copier le modèle Opposition au paiement" }).click();
  await expect(page.getByText("{date_constat}", { exact: true })).toBeVisible();
  // Aperçu avec les valeurs d'exemple d'une opposition
  await expect(page.getByLabel("Aperçu de la lettre").getByText(/RIB 007780000123456789012345/)).toBeVisible();
});
