import type { MetadataRoute } from "next";
import { appConfig } from "@/lib/config";

/** Manifeste de l'application installable (téléphone, tablette, PC). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: appConfig.name,
    short_name: appConfig.name,
    description: appConfig.description,
    lang: "fr",
    dir: "ltr",
    start_url: "/tableau-de-bord",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    categories: ["business", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nouveau paiement", url: "/paiements/nouveau" },
      { name: "Calendrier des échéances", url: "/calendrier" },
      { name: "Alertes", url: "/alertes" },
    ],
  };
}
