"use client";

import { WifiOffIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { formatDateTime } from "@/lib/format";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Attribut posé par le service worker sur la copie de la page gardée sur l'appareil. */
function subscribeSavedAt(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-offline-saved-at"] });
  return () => observer.disconnect();
}

function readSavedAt(): string | null {
  return document.documentElement.dataset.offlineSavedAt ?? null;
}

/**
 * Bandeau « Hors connexion » : date des données quand la page vient de l'appareil
 * (gardée par le service worker), et modifications désactivées sans réseau.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const savedAt = useSyncExternalStore(subscribeSavedAt, readSavedAt, () => null);
  const pathname = usePathname();
  const firstPathname = useRef(pathname);

  // Navigation réussie dans l'application : les données affichées viennent du serveur
  useEffect(() => {
    if (pathname !== firstPathname.current) {
      delete document.documentElement.dataset.offlineSavedAt;
    }
  }, [pathname]);

  const offline = !online || savedAt !== null;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-offline", offline);
  }, [offline]);

  if (!offline) {
    return null;
  }
  const savedDate = savedAt ? new Date(Number(savedAt)) : null;
  return (
    <div role="status" className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <WifiOffIcon className="size-4 shrink-0" aria-hidden />
      <span>
        Hors connexion
        {savedDate && !Number.isNaN(savedDate.getTime()) && ` · données du ${formatDateTime(savedDate)}`}. Consultation seule :
        les modifications reprendront avec le réseau.
      </span>
    </div>
  );
}
