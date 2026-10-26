import { z } from "zod";

/**
 * Variables d'environnement publiques (exposées au navigateur).
 * Les références à process.env.NEXT_PUBLIC_* doivent rester littérales pour
 * que Next.js les remplace à la compilation.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

/**
 * URL publique du site, utilisée dans les liens des e-mails :
 * NEXT_PUBLIC_SITE_URL si elle est définie, sinon l'URL de la branche pour un
 * déploiement de prévisualisation Vercel, sinon l'URL de production Vercel.
 */
function resolveSiteUrl(): string | undefined {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" && process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return undefined;
}

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: resolveSiteUrl(),
});
