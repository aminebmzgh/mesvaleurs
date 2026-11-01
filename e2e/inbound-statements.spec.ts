import { createHmac } from "node:crypto";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { login, uniqueSuffix } from "./helpers";

/**
 * Relevés reçus par e-mail, contre le faux Resend (e2e/fixtures/resend-mock.mjs) : le test y
 * dépose un e-mail reçu, puis appelle le webhook signé de l'application.
 */
const RESEND_MOCK_URL = "http://localhost:3102";
// Même secret que l'environnement de l'application (playwright.config.ts)
const WEBHOOK_KEY = Buffer.from("e2e-webhook-secret-0123456789");

async function postWebhook(request: APIRequestContext, emailId: string, key = WEBHOOK_KEY) {
  const body = JSON.stringify({ type: "email.received", created_at: new Date().toISOString(), data: { email_id: emailId } });
  const id = `msg_${emailId}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return request.post("/api/inbound/resend", {
    data: body,
    headers: { "Content-Type": "application/json", "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` },
  });
}

test("relevé reçu à l'adresse de l'entreprise : rangé dans la boîte, puis importé", async ({ page, request }) => {
  test.setTimeout(90_000);
  const suffix = uniqueSuffix();
  const filename = `releve-courriel-${suffix}.csv`;
  await login(page, "gestionnaire@demo.ma");
  await page.goto("/rapprochement");
  // Carte affichée en différé : attendre l'adresse existante ou le bouton de création
  const create = page.getByRole("button", { name: "Créer l'adresse de réception" });
  const addressField = page.getByLabel("Adresse de réception des relevés");
  await expect(addressField.or(create)).toBeVisible();
  await page.waitForLoadState("networkidle");
  if (await create.isVisible()) {
    await create.click();
  }
  const address = (await addressField.innerText()).trim();
  expect(address).toMatch(/^releves-[a-z0-9]{12}@import\.mesvaleurs\.ma$/);

  // E-mail de la banque : le relevé CSV et un logo inséré dans le message (ignoré)
  const csv = ["Date opération;Date valeur;Libellé;Débit;Crédit", `29/10/2026;29/10/2026;FRAIS TENUE COMPTE ${suffix};45,00;`, ""].join("\r\n");
  const emailId = `e2e-${suffix}`;
  await request.post(`${RESEND_MOCK_URL}/__emails`, {
    data: {
      id: emailId,
      from: "Banque <releves@banque.ma>",
      to: [`Relevés <${address}>`],
      subject: `Relevé ${suffix}`,
      attachments: [
        { filename, contentType: "text/csv", content: csv },
        { filename: "logo.png", contentType: "image/png", content: "png", inline: true },
      ],
    },
  });

  // Signature invalide : refusé
  expect((await postWebhook(request, emailId, Buffer.from("mauvais-secret"))).status()).toBe(401);
  const response = await postWebhook(request, emailId);
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "saved", count: 1 });
  // Webhook rejoué par Resend : aucun doublon
  expect((await postWebhook(request, emailId)).status()).toBe(200);

  await page.reload();
  const inbox = page.getByRole("list", { name: "Relevés à importer" });
  const item = inbox.getByRole("listitem").filter({ hasText: filename });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("De Banque <releves@banque.ma>");
  await item.getByRole("link", { name: "Importer" }).click();

  await expect(page.getByText(`Relevé reçu par e-mail : ${filename}`)).toBeVisible();
  await page.getByLabel("Compte bancaire").selectOption({ label: "Compte principal · Attijariwafa bank" });
  await page.getByRole("button", { name: /Importer et rapprocher 1 mouvement/ }).click();
  await expect(page).toHaveURL(/\/rapprochement\/[0-9a-f-]{36}$/);

  await page.goto("/rapprochement");
  await expect(page.getByRole("listitem").filter({ hasText: filename })).toHaveCount(0);
  await page.getByText("Déjà traités").click();
  await expect(page.getByText(new RegExp(`${filename} · importé`))).toBeVisible();
});

test("adresse inconnue ou renouvelée : rien n'est rangé", async ({ request }) => {
  const emailId = `e2e-inconnu-${uniqueSuffix()}`;
  await request.post(`${RESEND_MOCK_URL}/__emails`, {
    data: {
      id: emailId,
      from: "x@exemple.ma",
      to: ["releves-zzzzzzzzzzzz@import.mesvaleurs.ma"],
      subject: "Test",
      attachments: [{ filename: "releve.csv", contentType: "text/csv", content: "a;b" }],
    },
  });
  const response = await postWebhook(request, emailId);
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ignored", reason: "Adresse de réception inconnue ou renouvelée." });
});
