import { expect, test } from "@playwright/test";
import { confirmFundsIfNeeded, login, selectOption, uniqueSuffix } from "./helpers";

/** Trimestre en cours (fuseau de l'entreprise), au format des liens : « 2026-T4 ». */
function currentQuarterKey() {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca" }).format(new Date());
  return `${today.slice(0, 4)}-T${Math.ceil(Number(today.slice(5, 7)) / 3)}`;
}

test("facture payée hors délai : dans l'état trimestriel avec son amende, exportable", async ({ page }) => {
  const number = `LATE-${uniqueSuffix()}`;
  await login(page, "gestionnaire@demo.ma");

  // Facture de janvier (Bureau Pro : 30 jours, date limite le 04/02), réglée aujourd'hui
  await page.goto("/factures/nouvelle");
  await selectOption(page, "Fournisseur", "Bureau Pro Fournitures");
  await page.getByLabel("Numéro de facture").fill(number);
  await page.getByLabel("Date de facture").fill(`${new Date().getFullYear()}-01-05`);
  await page.getByLabel("Montant HT (DH)").fill("1 000,00");
  await page.getByRole("button", { name: "Enregistrer la facture" }).click();
  await expect(page.getByRole("heading", { name: `Facture ${number}` })).toBeVisible();

  await page.goto("/paiements/nouveau");
  const checkbook = page.getByLabel("Chéquier");
  const options = await checkbook.locator("option").allTextContents();
  await checkbook.selectOption({ label: options.find((label) => label.startsWith("Compte principal"))! });
  await page.getByLabel("Fournisseur", { exact: true }).selectOption({ label: "Bureau Pro Fournitures" });
  // Factures du fournisseur chargées : seule la nôtre reste cochée (les autres servent à d'autres tests)
  await expect(page.getByLabel(`Régler la facture ${number}`)).toBeChecked();
  for (const box of await page.getByRole("checkbox", { name: /^Régler la facture / }).all()) {
    if ((await box.getAttribute("aria-label")) !== `Régler la facture ${number}` && (await box.isChecked())) {
      await box.uncheck();
    }
  }
  await expect(page.getByLabel("Montant à régler (DH)")).toHaveValue(/^1\s200,00$/);
  page.once("dialog", (dialog) => dialog.accept());
  await confirmFundsIfNeeded(page);
  await page.getByRole("button", { name: "Émettre 1 chèque" }).click();
  await expect(page.getByText("Numéros attribués")).toBeVisible();

  const quarter = currentQuarterKey();
  await page.goto(`/conformite?trimestre=${quarter}`);
  await expect(page.getByText("Calculs indicatifs — à valider par votre expert-comptable")).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: number });
  await expect(row.getByText("Payée hors délai")).toBeVisible();
  await expect(row.getByText(/^Chèque \d+/)).toBeVisible();
  await expect(row.getByRole("cell", { name: /^\d+ mois$/ })).toBeVisible();
  // Amende : 1 200 DH TTC × (2,25 % + 0,85 % par mois supplémentaire) > 0
  await expect(row.getByRole("cell", { name: /^[1-9][\d\s]*,\d{2}\sDH$/ }).last()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "CSV" }).click();
  const csv = await (await (await download).createReadStream()).toArray();
  const text = Buffer.concat(csv).toString("utf8");
  expect(text).toContain("Amende indicative");
  expect(text).toContain(`${number};`);
});

test("trimestre écoulé marqué comme déclaré, puis annulé", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/conformite");
  const card = page.locator("[data-slot=card]").filter({ hasText: /^Déclaration du T\d \d{4}/ });
  // Test rejouable : une exécution interrompue a pu laisser le trimestre déclaré
  if (await card.getByText("Déclaré", { exact: true }).isVisible()) {
    await card.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByText("Déclaration annulée.")).toBeVisible();
  }
  await card.getByLabel("Référence (facultative)").fill("DGI-E2E");
  await card.getByRole("button", { name: "Marquer comme déclaré" }).click();
  // Le formulaire laisse place à l'état « Déclaré »
  await expect(card.getByText("Déclaré", { exact: true })).toBeVisible();
  await expect(card.getByText(/· DGI-E2E/)).toBeVisible();

  await card.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("Déclaration annulée.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Marquer comme déclaré" })).toBeVisible();
});

test("le préparateur consulte sans pouvoir déclarer", async ({ page }) => {
  await login(page, "preparateur@demo.ma");
  await page.getByRole("link", { name: "Délais de paiement" }).click();
  await expect(page.getByRole("heading", { name: "Délais de paiement" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marquer comme déclaré" })).toHaveCount(0);
});
