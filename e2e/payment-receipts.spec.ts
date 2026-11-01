import { expect, type Page, test } from "@playwright/test";
import { confirmFundsIfNeeded, login, uniqueSuffix } from "./helpers";

/** Chèque émis pour l'occasion : les autres tests gardent les paiements du seed intacts. */
async function issueCheck(page: Page, invoice: string) {
  await page.goto("/paiements/nouveau");
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Bureau Pro Fournitures" });
  await page.getByRole("button", { name: "Saisir une nouvelle facture" }).click();
  await page.getByLabel("Numéro de facture").fill(invoice);
  await page.getByLabel("Montant TTC (DH)").fill("2 400,00");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(`Facture ${invoice} enregistrée.`)).toBeVisible();
  // Sa facture cochée avant de décocher les autres (sinon les factures du seed seraient réglées)
  await expect(page.getByRole("checkbox", { name: `Régler la facture ${invoice}` })).toBeChecked();
  for (const checkbox of await page.getByRole("checkbox", { name: /^Régler la facture / }).all()) {
    if ((await checkbox.getAttribute("aria-label")) !== `Régler la facture ${invoice}` && (await checkbox.isChecked())) {
      await checkbox.uncheck();
    }
  }
  page.once("dialog", (dialog) => dialog.accept());
  await confirmFundsIfNeeded(page);
  await page.getByRole("button", { name: "Émettre 1 chèque" }).click();
  await expect(page.getByText("Numéros attribués")).toBeVisible();
  return (await page.getByRole("row").nth(1).getByRole("cell").first().innerText()).trim();
}

/** Signature tracée à la souris dans la zone de signature. */
async function sign(page: Page) {
  // La souris ne trace que dans la partie visible de la page
  const pad = page.getByRole("img", { name: "Zone de signature" });
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(box.x + 30 + step * 20, box.y + box.height / 2 + (step % 2 ? -25 : 25));
  }
  await page.mouse.up();
}

test("remise signée à l'écran : accusé numéroté, chèque remis, reçu PDF", async ({ page }) => {
  test.setTimeout(90_000);
  const invoice = `AR-${uniqueSuffix()}`;
  await login(page, "preparateur@demo.ma");
  const number = await issueCheck(page, invoice);

  // Depuis le lot émis
  await page.getByRole("link", { name: "Faire signer la remise" }).click();
  await expect(page.getByRole("heading", { name: "Remise signée" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: new RegExp(`Chèque ${number}`) })).toBeChecked();

  const validate = page.getByRole("button", { name: "Valider la remise signée" });
  await page.getByLabel("Nom et prénom").fill("Youssef Livreur");
  await expect(validate).toBeDisabled();
  await sign(page);
  await page.getByLabel("CIN (facultatif)").fill("bk998877");
  await validate.click();

  await expect(page.getByRole("heading", { name: /^Accusé de réception AR-\d{4}-\d{4}$/ })).toBeVisible();
  await expect(page.getByText("Remise signée enregistrée")).toBeVisible();
  await expect(page.getByText("Youssef Livreur")).toBeVisible();
  await expect(page.getByText("BK998877")).toBeVisible();
  await expect(page.getByRole("img", { name: "Signature de Youssef Livreur" })).toBeVisible();
  await expect(page.getByRole("link", { name: `Chèque ${number}` })).toBeVisible();

  const pdf = await page.request.get(await page.getByRole("link", { name: "Reçu PDF" }).getAttribute("href") ?? "");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // E-mails désactivés pendant les tests : l'envoi le signale sans rien envoyer
  await page.getByLabel("E-mail du fournisseur").fill("ventes@bureaupro.ma");
  await page.getByRole("button", { name: "Envoyer le reçu" }).click();
  await expect(page.getByText("L'envoi d'e-mails n'est pas configuré sur ce serveur.")).toBeVisible();

  // Le chèque est remis : plus rien à faire signer
  await page.goto(`/paiements?numero=${Number(number)}&statut=all`);
  const row = page.getByRole("row").filter({ hasText: number }).first();
  await expect(row.getByText("Remis", { exact: true })).toBeVisible();
  await expect(row.getByRole("link", { name: "Faire signer" })).toHaveCount(0);

  await page.getByRole("link", { name: "Accusés de réception" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Youssef Livreur" }).first()).toContainText("Bureau Pro Fournitures");
});
