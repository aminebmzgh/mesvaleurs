import "server-only";
import { z } from "zod";

/**
 * Variables d'environnement secrètes, uniquement côté serveur.
 * Lues à la demande pour ne pas bloquer le build si elles sont absentes.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
