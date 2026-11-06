import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { login } from "./helpers";

const SOUSS = "b0000000-0000-4000-8000-000000000002";

/** Entrée de la navigation, avec le badge de l'offre requise. */
const navItem = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });

/** Client service_role de la base locale (clés de `.env.local`, écrites aussi par la CI). */
function localAdmin() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url ?? "")) {
    throw new Error("Test réservé à la base locale.");
  }
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

test("abonnement : essai en cours, consommation et comparatif des offres", async ({ page }) => {
  await login(page, "admin@demo.ma");
  // Entreprise du seed : essai de 14 jours de l'offre Business, signalé dans l'en-tête
  await page.getByRole("link", { name: /Essai Business : \d+ jours?/ }).click();
  await expect(page.getByRole("heading", { name: "Abonnement", exact: true })).toBeVisible();
  await expect(page.getByText(/Essai de l'offre Business : \d+ jours? restants?/)).toBeVisible();
  await expect(page.getByText("Offre Business (essai)")).toBeVisible();
  await expect(page.getByText("Paiements créés ce mois-ci")).toBeVisible();
  await expect(page.getByText("1 490 DH")).toBeVisible();
  await expect(page.getByRole("row", { name: /Double signature et plafonds/ })).toBeVisible();
  // Pendant l'essai, aucun lien de la navigation n'est signalé comme réservé
  await expect(navItem(page, "Statistiques")).not.toContainText("Pro");
});

test("offre Gratuit : fonctionnalités Pro signalées et fermées, limites appliquées", async ({ page }) => {
  const admin = localAdmin();
  const { data: before } = await admin.from("subscriptions").select("plan, trial_ends_at").eq("organization_id", SOUSS).single();
  await admin.from("subscriptions").update({ plan: "free", trial_ends_at: null }).eq("organization_id", SOUSS);
  try {
    await login(page, "souss@demo.ma");
    await expect(page.getByRole("link", { name: /Essai/ })).toHaveCount(0);
    await expect(navItem(page, "Statistiques")).toContainText("Pro");
    await expect(navItem(page, "Journal d'audit")).toContainText("Business");

    await page.goto("/statistiques");
    await expect(page.getByRole("heading", { name: "Statistiques : offre Pro" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir les offres" })).toHaveAttribute("href", "/parametres/abonnement");

    // Route de téléchargement fermée elle aussi
    expect((await page.request.get("/journal/export")).status()).toBe(403);

    await page.goto("/parametres/abonnement");
    await expect(page.getByText("Offre Gratuit", { exact: true })).toBeVisible();
    await expect(page.getByText("1 sur 1").first()).toBeVisible();

    // 1 utilisateur : pas d'invitation possible
    await page.goto("/parametres/membres");
    await page.getByLabel("Adresse e-mail").fill("nouveau-membre@souss.ma");
    await page.getByRole("button", { name: /Inviter/ }).click();
    await expect(page.getByText("Votre offre Gratuit permet 1 utilisateur(s). Passez à une offre supérieure pour ajouter un membre.")).toBeVisible();
  } finally {
    await admin.from("subscriptions").update(before!).eq("organization_id", SOUSS);
  }
});
