import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      // Lignes de relevés importés (quelques milliers) ; plafond Vercel : 4,5 Mo
      bodySizeLimit: "4mb",
    },
  },
  partialPrefetching: true,
  async headers() {
    return [
      {
        // Service worker : toujours revalidé, pour que les mises à jour soient prises en compte
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        // OCR : moteur et modèle de langue (plusieurs Mo), gardés une semaine par le navigateur
        source: "/ocr/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
