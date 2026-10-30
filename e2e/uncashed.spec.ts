import { expect, test } from "@playwright/test";
import { confirmFundsIfNeeded, login, uniqueSuffix } from "./helpers";

test("chèque non encaissé depuis longtemps : liste, relance par e-mail, alerte", async ({ page }) => {
  const invoiceNumber = `ANC-${uniqueSuffix()}`;
  await login(page, "gestionnaire@demo.ma");

  // Chèque émis il y a 100 jours, jamais débité
  const issueDate = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 100);
    return date.toLocaleDateString("sv-SE");
  });
  await page.goto("/paiements/nouveau");
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Bureau Pro Fournitures" });
  await page.getByRole("button", { name: "Saisir une nouvelle facture" }).click();
  await page.getByLabel("Numéro de facture").fill(invoiceNumber);
  await page.getByLabel("Montant TTC (DH)").fill("1 500,00");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(`Facture ${invoiceNumber} enregistrée.`)).toBeVisible();
  for (const box of await page.getByRole("checkbox", { name: /^Régler la facture / }).all()) {
    if ((await box.getAttribute("aria-label")) !== `Régler la facture ${invoiceNumber}` && (await box.isChecked())) {
      await box.uncheck();
    }
  }
  await page.getByLabel("Date d'émission").fill(issueDate);
  await confirmFundsIfNeeded(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Émettre 1 chèque" }).click();
  await expect(page.getByText("Numéros attribués")).toBeVisible();
  const number = (await page.getByRole("row").nth(1).getByRole("cell").first().textContent())!.trim();

  // Liste des non encaissés (90 jours) : ancienneté et lien de relance pré-rempli
  await page.getByRole("link", { name: "Non encaissés" }).click();
  await page.goto("/paiements/non-encaisses?jours=90");
  const row = page.getByRole("row").filter({ hasText: number });
  await expect(row.getByText("100 j")).toBeVisible();
  const mailto = await row.getByRole("link", { name: "Relancer par e-mail" }).getAttribute("href");
  expect(mailto).toMatch(/^mailto:ventes%40bureaupro\.ma\?subject=/);
  expect(decodeURIComponent(mailto!)).toContain(`Chèque ${number} du `);

  // Tableau de bord : alerte au-delà du délai de l'entreprise (60 jours par défaut)
  await page.goto("/tableau-de-bord");
  await expect(page.getByText(/chèques? non encaissés? depuis plus de 60 jours/)).toBeVisible();
});
