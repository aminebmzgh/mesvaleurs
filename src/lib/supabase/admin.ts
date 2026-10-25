import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Client Supabase avec la clé service_role : contourne la RLS.
 * Réservé aux traitements serveur qui l'exigent (invitations, tâches planifiées,
 * webhooks). Ne jamais l'utiliser pour lire des données à afficher à un utilisateur.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
