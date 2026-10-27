import { expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

test("une création apparaît au journal avec son auteur, filtrable et exportable", async ({ browser }) => {
  const name = `Fournisseur audit ${uniqueSuffix()}`;

  // Le préparateur crée un fournisseur, et n'a pas accès au journal
  const preparer = await browser.newPage();
  await login(preparer, "preparateur@demo.ma");
  await expect(preparer.getByRole("link", { name: "Journal d'audit" })).toHaveCount(0);
  await preparer.goto("/fournisseurs/nouveau");
  await preparer.getByLabel("Raison sociale").fill(name);
  await preparer.getByRole("button", { name: "Créer le fournisseur" }).click();
  await expect(preparer.getByRole("heading", { name })).toBeVisible();
  await preparer.goto("/journal");
  await expect(preparer).toHaveURL(/\/tableau-de-bord\?erreur=acces-refuse/);
  await preparer.close();

  // Le gestionnaire retrouve l'action dans le journal
  const manager = await browser.newPage();
  await login(manager, "gestionnaire@demo.ma");
  await manager.getByRole("link", { name: "Journal d'audit" }).click();
  await expect(manager.getByRole("heading", { name: "Journal d'audit" })).toBeVisible();
  await manager.goto("/journal?objet=suppliers&action=insert");
  const row = manager.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row.getByText("Youssef Amrani")).toBeVisible();
  await expect(row.getByText("Création")).toBeVisible();

  // Détail des champs renseignés
  await row.getByText(/champs?$/).click();
  await expect(row.getByText("Raison sociale").or(row.getByText("Nom"))).toBeVisible();

  // Export CSV avec les mêmes filtres
  const response = await manager.request.get("/journal/export?objet=suppliers&action=insert");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(await response.text()).toContain(name);
  await manager.close();
});
