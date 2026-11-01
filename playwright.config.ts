import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout : application construite (`next build` + `next start`)
 * contre la base Supabase locale chargée avec le seed de démonstration.
 * Prérequis : `pnpm db:start` (ou `pnpm db:reset` pour repartir du seed) et `.env.local`.
 */
const PORT = 3100;
/** Faux service d'IA (OpenRouter) : aucune facture n'est envoyée au vrai service. */
const AI_MOCK_PORT = 3101;
/** Faux Resend (réception des relevés par e-mail) et secret de son webhook. */
const RESEND_MOCK_PORT = 3102;
const E2E_WEBHOOK_SECRET = `whsec_${Buffer.from("e2e-webhook-secret-0123456789").toString("base64")}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Premier rendu après redirection parfois lent sur un serveur froid (CI)
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/fixtures/openrouter-mock.mjs",
      url: `http://localhost:${AI_MOCK_PORT}/last`,
      reuseExistingServer: !process.env.CI,
      env: { OPENROUTER_MOCK_PORT: String(AI_MOCK_PORT) },
    },
    {
      command: "node e2e/fixtures/resend-mock.mjs",
      url: `http://localhost:${RESEND_MOCK_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      env: { RESEND_MOCK_PORT: String(RESEND_MOCK_PORT) },
    },
    {
      command: `pnpm build && pnpm start --port ${PORT}`,
      url: `http://localhost:${PORT}/connexion`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
        // Tâche planifiée appelée par les tests ; aucun e-mail réel n'est envoyé
        CRON_SECRET: "e2e-cron-secret-0123456789",
        RESEND_API_KEY: "",
        EMAIL_FROM: "",
        OPENROUTER_API_KEY: "e2e-fake-key",
        OPENROUTER_BASE_URL: `http://localhost:${AI_MOCK_PORT}/v1`,
        OPENROUTER_MODEL: "e2e/faux-modele",
        RESEND_WEBHOOK_SECRET: E2E_WEBHOOK_SECRET,
        RESEND_INBOUND_KEY: "e2e-fake-inbound-key",
        RESEND_API_URL: `http://localhost:${RESEND_MOCK_PORT}`,
      },
    },
  ],
});
