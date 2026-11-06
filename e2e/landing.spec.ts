import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("page d'accueil publique : présentation, tarifs, questions et pages légales", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: /Vos chèques et effets/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rapprochement bancaire" })).toBeVisible();

  // Tarifs : mêmes composants que la page Abonnement
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Tarifs" }).click();
  await expect(page.getByText("1 490 DH")).toBeVisible();
  await expect(page.getByRole("row", { name: /Double signature et plafonds/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Commencer gratuitement" })).toHaveAttribute("href", "/inscription");

  await page.getByText("Comment payer mon abonnement ?").click();
  await expect(page.getByText(/écrivez-nous à contact@mesvaleurs\.ma/)).toBeVisible();

  await page.getByRole("contentinfo").getByRole("link", { name: "Confidentialité" }).click();
  await expect(page.getByRole("heading", { name: "Politique de confidentialité" })).toBeVisible();
  await expect(page.getByText(/OpenRouter Inc\./)).toBeVisible();
  await page.getByRole("contentinfo").getByRole("link", { name: "Mentions légales" }).click();
  await expect(page.getByRole("heading", { name: "Mentions légales", level: 1 })).toBeVisible();

  // Référencement : seules les pages publiques
  const robots = await (await page.request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /");
  expect(robots).toContain("Sitemap:");
  expect((await page.request.get("/sitemap.xml")).status()).toBe(200);
});

test("page d'accueil : un utilisateur connecté va à son tableau de bord", async ({ page }) => {
  await login(page, "admin@demo.ma");
  await page.goto("/");
  await expect(page).toHaveURL(/\/tableau-de-bord/);
});
