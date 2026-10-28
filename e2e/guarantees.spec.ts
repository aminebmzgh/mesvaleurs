import { expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

test("chèque de garantie : émission, rappel de restitution, risque d'encaissement, restitution", async ({ page }) => {
  const purpose = `Caution E2E ${uniqueSuffix()}`;
  await login(page, "gestionnaire@demo.ma");

  await page.goto("/paiements");
  await page.getByRole("link", { name: "Chèque de garantie" }).click();
  await page.getByLabel("Fournisseur").selectOption({ label: "Maghreb Emballages SA" });
  await expect(page.getByLabel("Bénéficiaire imprimé")).toHaveValue("MAGHREB EMBALLAGES");
  await page.getByLabel("Montant (DH)").fill("25 000,00");
  await page.getByLabel("Objet de la garantie").fill(purpose);
  // Restitution prévue dans 3 jours : rappel sur le tableau de bord
  const returnDue = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toLocaleDateString("sv-SE");
  });
  await page.getByLabel("Restitution prévue le").fill(returnDue);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Émettre le chèque de garantie" }).click();

  // Lot imprimable, comme un chèque ordinaire
  await expect(page.getByText("Numéros attribués")).toBeVisible();
  const number = (await page.getByRole("row").nth(1).getByRole("cell").first().textContent())!.trim();
  await expect(page.getByText("Aucune facture").or(page.getByText("—")).first()).toBeVisible();

  // Tableau de bord : rappel et risque d'encaissement
  await page.goto("/tableau-de-bord");
  await expect(page.getByText("Chèques de garantie à récupérer")).toBeVisible();
  await expect(page.getByText(`Chèque de garantie ${number}`)).toBeVisible();
  await expect(page.getByText("Risque d'encaissement")).toBeVisible();

  // Restitution depuis la liste
  await page.goto(`/paiements?numero=${number}&statut=all`);
  const row = page.getByRole("row").filter({ hasText: number });
  await expect(row.getByText(purpose)).toBeVisible();
  await row.getByRole("button", { name: "Restitué" }).click();
  await page.getByRole("button", { name: "Enregistrer la restitution" }).click();
  await expect(page.getByText("Restitution enregistrée.")).toBeVisible();
  await expect(row.getByText("Chèque de garantie restitué")).toBeVisible();

  await page.goto("/tableau-de-bord");
  await expect(page.getByText(`Chèque de garantie ${number}`)).toHaveCount(0);
});
