import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Centrale Agro Distribution (seed) : un chèque émis, un chèque annulé, une facture partiellement réglée, une contestée
const SUPPLIER_URL = "/fournisseurs/e0000000-0000-4000-8000-000000000004";

test("le fournisseur suit ses règlements par son lien, jusqu'à sa désactivation", async ({ page, browser }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, "gestionnaire@demo.ma");
  await page.goto(SUPPLIER_URL);

  const portal = page.locator("#portail");
  await expect(portal.getByText("Portail fournisseur", { exact: true })).toBeVisible();
  // Rejouable : un lien laissé par un essai précédent est remplacé
  if (await portal.getByRole("button", { name: "Nouveau lien" }).isVisible()) {
    await portal.getByRole("button", { name: "Nouveau lien" }).click();
  } else {
    await portal.getByRole("button", { name: "Créer le lien" }).click();
  }
  const linkInput = portal.getByLabel("Lien du portail");
  await expect(linkInput).toHaveValue(/\/suivi\/[A-Za-z0-9_-]{32}$/);
  await expect(portal.getByText("pas encore consulté")).toBeVisible();
  const url = await linkInput.inputValue();

  // Visiteur sans compte
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(new URL(url).pathname);
  await expect(visitor.getByRole("heading", { name: "Atlas Distribution SARL" })).toBeVisible();
  await expect(visitor.getByText("à Centrale Agro Distribution")).toBeVisible();
  await expect(visitor.getByText("Prêt, à remettre").first()).toBeVisible();
  await expect(visitor.getByText("CAD-2026-332").first()).toBeVisible();
  await expect(visitor.getByText("En cours d'examen")).toBeVisible();
  // Le chèque annulé n'apparaît pas
  await expect(visitor.getByText("n° 1004")).toHaveCount(0);
  // Jamais référencé
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // La consultation est visible côté entreprise
  await page.reload();
  await expect(portal.getByText(/consulté 1 fois/)).toBeVisible();

  // Désactivation : le lien ne fonctionne plus
  await portal.getByRole("button", { name: "Désactiver" }).click();
  await expect(portal.getByRole("button", { name: "Créer le lien" })).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: "Ce lien de suivi n'est plus actif" })).toBeVisible();
  await visitorContext.close();
});

test("le préparateur voit le lien sans pouvoir le gérer", async ({ page }) => {
  await login(page, "preparateur@demo.ma");
  await page.goto(SUPPLIER_URL);
  const portal = page.locator("#portail");
  await expect(portal.getByText("Portail fournisseur", { exact: true })).toBeVisible();
  await expect(portal.getByRole("button", { name: "Créer le lien" })).toHaveCount(0);
  await expect(portal.getByRole("button", { name: "Désactiver" })).toHaveCount(0);
});
