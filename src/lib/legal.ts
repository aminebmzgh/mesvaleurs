import { SALES_EMAIL } from "@/lib/billing/plans";

/** Informations légales de l'éditeur, affichées dans les mentions légales et la politique de confidentialité. */
export const LEGAL = {
  companyName: "MesValeurs",
  city: "Casablanca",
  contactEmail: SALES_EMAIL,
  updatedAt: "6 novembre 2026",
} as const;

/** Sous-traitants qui traitent des données pour le compte de MesValeurs. */
export const PROCESSORS = [
  { name: "Supabase Inc.", role: "Base de données, authentification et stockage des fichiers", location: "Union européenne (Paris, France)" },
  { name: "Vercel Inc.", role: "Hébergement de l'application", location: "États-Unis et Union européenne" },
  { name: "Resend Inc.", role: "Envoi et réception des e-mails (alertes, invitations, relevés)", location: "Union européenne (Irlande)" },
  {
    name: "OpenRouter Inc.",
    role: "Intelligence artificielle, uniquement si votre entreprise l'active : données personnelles masquées avant l'envoi, sans conservation",
    location: "États-Unis",
  },
] as const;
