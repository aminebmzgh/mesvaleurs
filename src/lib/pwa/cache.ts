/**
 * Pages gardées sur l'appareil pour la consultation hors connexion. Le nom du cache
 * est repris dans public/sw.js (le service worker n'importe pas de module).
 */
export const PAGES_CACHE = "mv-pages-v1";

/** Efface les pages gardées : à la déconnexion et au changement d'entreprise. */
export async function clearOfflinePages(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      await caches.delete(PAGES_CACHE);
    }
  } catch {
    // Cache indisponible (navigation privée, navigateur ancien) : rien à effacer
  }
}
