/**
 * Configuration générale de l'application.
 * Le nom du produit est modifiable via NEXT_PUBLIC_APP_NAME.
 */
export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "MesValeurs",
  description:
    "Gestion, impression et rapprochement bancaire des chèques et LCN pour les entreprises marocaines",
  timeZone: "Africa/Casablanca",
  currency: "MAD",
} as const;

/** Cookie mémorisant l'organisation active de l'utilisateur. */
export const ACTIVE_ORGANIZATION_COOKIE = "mv_org";
