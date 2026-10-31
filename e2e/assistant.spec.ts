import { expect, test } from "@playwright/test";
import { enableAi, login } from "./helpers";

/**
 * Assistant IA, contre le faux service OpenRouter (e2e/fixtures/openrouter-mock.mjs) : il appelle
 * l'outil choisi d'après la question, puis répond avec le nombre, le total et le premier lien.
 */
const AI_MOCK_URL = "http://localhost:3101";

test("assistant : réponses tirées des données par les outils, liens vers les écrans, données personnelles masquées", async ({ page, request }) => {
  test.setTimeout(90_000);
  await enableAi(page);
  // Le comptable, en lecture seule, peut interroger l'assistant
  await login(page, "comptable@demo.ma");
  await page.getByRole("link", { name: "Assistant IA" }).click();
  await expect(page.getByRole("heading", { name: "Assistant IA" })).toBeVisible();

  const log = page.getByRole("log", { name: "Conversation avec l'assistant" });
  await page.getByRole("button", { name: "Quels chèques ne sont pas encore passés ?" }).click();
  const firstAnswer = log.getByLabel("Réponse de l'assistant").first();
  await expect(firstAnswer).toContainText(/Réponse du faux assistant : \d+ résultat\(s\), montant/);
  await expect(firstAnswer.getByRole("link", { name: "Voir le détail" })).toHaveAttribute("href", /^\/paiements\?numero=\d+&statut=all$/);

  await page.getByLabel("Votre question").fill("Combien je dois encore à Sotrama ? Répondez-moi aussi à moi@exemple.ma");
  await page.getByLabel("Votre question").press("Enter");
  const secondAnswer = log.getByLabel("Réponse de l'assistant").nth(1);
  await expect(secondAnswer).toContainText("Réponse du faux assistant : 1 résultat(s)");
  const sent = await (await request.get(`${AI_MOCK_URL}/last`)).text();
  expect(sent).toContain("[e-mail]");
  expect(sent).not.toContain("moi@exemple.ma");

  await secondAnswer.getByRole("link", { name: "Voir le détail" }).click();
  await expect(page).toHaveURL(/\/fournisseurs\/e0000000-0000-4000-8000-000000000001$/);
  await expect(page.getByRole("heading", { name: "Sotrama Matériaux SARL" })).toBeVisible();
});
