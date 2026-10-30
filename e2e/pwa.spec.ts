import { expect, type Page, test } from "@playwright/test";
import { login } from "./helpers";

const savedPages = (page: Page) =>
  page.evaluate(async () => ((await caches.has("mv-pages-v1")) ? (await (await caches.open("mv-pages-v1")).keys()).length : 0));

test("application installable : manifeste et icônes", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "MesValeurs", display: "standalone", start_url: "/tableau-de-bord", lang: "fr" });
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await request.get(icon.src);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
  const worker = await request.get("/sw.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["cache-control"]).toContain("no-cache");
});

test("pages récentes consultables hors connexion, effacées à la déconnexion", async ({ page, context }) => {
  await login(page, "gestionnaire@demo.ma");
  // Le service worker prend la main sur la page, puis garde les pages consultées
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null);
  await page.goto("/alertes");
  await expect(page.getByRole("heading", { name: "Alertes", exact: true })).toBeVisible();
  await expect.poll(() => savedPages(page)).toBeGreaterThan(0);
  await expect(page.getByText(/^Hors connexion/)).toHaveCount(0);

  await context.setOffline(true);
  await page.goto("/alertes");
  await expect(page.getByRole("heading", { name: "Alertes", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /Hors connexion · données du \d{2}\/\d{2}\/\d{4}/ })).toBeVisible();

  // Page jamais consultée sur cet appareil
  await page.goto("/statistiques");
  await expect(page.getByRole("heading", { name: "Pas de connexion" })).toBeVisible();

  await context.setOffline(false);
  await page.goto("/tableau-de-bord");
  await expect(page.getByText(/^Hors connexion/)).toHaveCount(0);
  await page.getByRole("button", { name: "Menu utilisateur" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
  expect(await savedPages(page)).toBe(0);
});
