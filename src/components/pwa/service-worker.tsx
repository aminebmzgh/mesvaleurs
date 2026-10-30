"use client";

import { useEffect } from "react";

/** Enregistre le service worker (consultation hors connexion), en production seulement. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Navigateur sans service worker utilisable : l'application fonctionne en ligne
    });
  }, []);
  return null;
}
