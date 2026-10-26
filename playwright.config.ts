import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout : application construite (`next build` + `next start`)
 * contre la base Supabase locale chargée avec le seed de démonstration.
 * Prérequis : `pnpm db:start` (ou `pnpm db:reset` pour repartir du seed) et `.env.local`.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/connexion`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
  },
});
