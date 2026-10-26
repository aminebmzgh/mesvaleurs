import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client Supabase côté serveur (composants serveur, Server Actions, Route Handlers),
 * authentifié par les cookies de session : toutes les requêtes passent par la RLS.
 * Un nouveau client doit être créé pour chaque requête.
 */
export async function createClient() {
  // Données propres à la requête : jamais prérendues (le SDK lit aussi l'heure courante)
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un composant serveur, où les cookies sont en lecture seule :
            // le proxy se charge de rafraîchir la session.
          }
        },
      },
    },
  );
}
