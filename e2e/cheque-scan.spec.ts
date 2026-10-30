import { expect, type Page, test } from "@playwright/test";
import { login } from "./helpers";

const MAIN_ACCOUNT = "/comptes-bancaires/c0000000-0000-4000-8000-000000000001";

/**
 * Photo d'une formule, dessinée dans le navigateur : en-tête, RIB et numéro en clair,
 * puis la bande du bas (police à chasse fixe à la place de la police CMC7).
 */
async function chequePhoto(page: Page, { title, rib, number }: { title: string; rib: string; number: string }): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ title, rib, number }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1750;
      canvas.height = 800;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#fdf6e3";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#111111";
      context.font = "bold 40px Arial, sans-serif";
      context.fillText(title, 60, 90);
      context.font = "30px Arial, sans-serif";
      context.fillText("Payez contre ce chèque", 60, 190);
      context.fillText("A l'ordre de", 60, 290);
      context.fillText(`Compte n° ${rib.slice(0, 3)} ${rib.slice(3, 6)} ${rib.slice(6, 22)} ${rib.slice(22)}`, 700, 470);
      context.fillText(`Chèque : série N° ${number}`, 60, 600);
      context.font = "38px 'Courier New', monospace";
      context.fillText(`${number}   ${rib.slice(0, 6)}000   ${rib.slice(6, 22)} ${rib.slice(22)}`, 120, 730);
      return canvas.toDataURL("image/png");
    },
    { title, rib, number },
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

test("le premier chèque photographié pré-remplit le carnet", async ({ page }) => {
  test.setTimeout(120_000);
  const number = `8${String(Date.now()).slice(-6)}`;
  await login(page, "gestionnaire@demo.ma");
  await page.goto(MAIN_ACCOUNT);
  await page.waitForLoadState("networkidle");
  const photo = await chequePhoto(page, { title: "Attijariwafa bank", rib: "007780000123456789012396", number });
  await page.getByLabel("Lire le premier chèque (photo)").setInputFiles({ name: "cheque.png", mimeType: "image/png", buffer: photo });

  await expect(page.getByText(`Premier numéro lu : ${number}`)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("numéro imprimé et bande CMC7 concordants")).toBeVisible();
  await expect(page.getByText("Le chèque correspond bien au RIB de ce compte.")).toBeVisible();
  await expect(page.getByLabel("Premier numéro")).toHaveValue(number);
  // Carnet de 25 formules par défaut, puis 50
  await expect(page.getByLabel("Dernier numéro")).toHaveValue(String(Number(number) + 24));
  await page.getByLabel("Formules").selectOption("50");
  await expect(page.getByLabel("Dernier numéro")).toHaveValue(String(Number(number) + 49));

  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Carnet enregistré.")).toBeVisible();
  await expect(page.getByRole("cell", { name: `${number} → ${Number(number) + 49}` })).toBeVisible();
});

test("une LCN d'un autre compte : type proposé et alerte sur le RIB", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "gestionnaire@demo.ma");
  await page.goto(MAIN_ACCOUNT);
  await page.waitForLoadState("networkidle");
  const photo = await chequePhoto(page, { title: "LETTRE DE CHANGE", rib: "150500211501441691001583", number: "5000200" });
  await page.getByLabel("Lire le premier chèque (photo)").setInputFiles({ name: "lcn.png", mimeType: "image/png", buffer: photo });

  await expect(page.getByText("Premier numéro lu : 5000200")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Le RIB lu ne correspond pas à ce compte")).toBeVisible();
  await expect(page.locator("#type")).toHaveText(/Carnet de LCN/);
});
