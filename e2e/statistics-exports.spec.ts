import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("statistiques : total, répartition, mois et fournisseurs", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.getByRole("link", { name: "Statistiques" }).click();
  await expect(page.getByRole("heading", { name: "Statistiques" })).toBeVisible();
  await expect(page.getByText(/^Total réglé · 12 derniers mois$/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Dépenses par mois" }).getByRole("listitem")).toHaveCount(12);
  // Maghreb Emballages (LCN du seed) parmi les fournisseurs
  await expect(page.getByRole("list", { name: "Dépenses par fournisseur" }).getByText("Maghreb Emballages SA")).toBeVisible();

  await page.getByLabel("Période").selectOption(String(new Date().getFullYear()));
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page).toHaveURL(/periode=\d{4}/);
  await expect(page.getByText(/^Total réglé · Année \d{4}$/)).toBeVisible();
});

test("exports des listes en CSV, Excel et PDF, avec les filtres affichés", async ({ page }) => {
  await login(page, "comptable@demo.ma");
  await page.goto("/paiements?statut=all&type=lcn");
  const csvHref = await page.getByRole("link", { name: "CSV" }).getAttribute("href");
  expect(csvHref).toContain("statut=all");
  expect(csvHref).toContain("type=lcn");
  const csv = await page.request.get(csvHref!);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text).toContain("Type;Numéro;Fournisseur");
  expect(text).toContain("LCN;5000101");
  expect(text).not.toMatch(/\nChèque;/);

  await page.goto("/factures");
  for (const [name, type] of [["Excel", "spreadsheetml"], ["PDF", "application/pdf"]]) {
    const response = await page.request.get((await page.getByRole("link", { name, exact: true }).getAttribute("href"))!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(type);
  }

  await page.goto("/fournisseurs");
  const suppliers = await (await page.request.get((await page.getByRole("link", { name: "CSV" }).getAttribute("href"))!)).text();
  expect(suppliers).toContain("Sotrama Matériaux SARL");
});
