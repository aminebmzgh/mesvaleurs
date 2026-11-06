import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/** Seules les pages publiques sont référencées ; l'espace connecté est exclu. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/$", "/mentions-legales", "/confidentialite"], disallow: "/" },
    sitemap: `${publicEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
