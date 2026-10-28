import {
  BanknoteIcon,
  BuildingIcon,
  ClockAlertIcon,
  FileBarChartIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  type LucideIcon,
  ShieldCheckIcon,
  SquarePenIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";
import type { AppRole } from "@/types/app";

/** `roles` : lien réservé à ces rôles (sinon visible de tous). */
export type NavItem = { title: string; href: string; icon: LucideIcon; roles?: AppRole[] };
export type NavSection = { label?: string; items: NavItem[] };

export const navigation: NavSection[] = [
  {
    items: [{ title: "Tableau de bord", href: "/tableau-de-bord", icon: LayoutDashboardIcon }],
  },
  {
    label: "Paiements",
    items: [
      { title: "Nouveau paiement", href: "/paiements/nouveau", icon: SquarePenIcon },
      { title: "Chèques et LCN", href: "/paiements", icon: BanknoteIcon },
      { title: "Non encaissés", href: "/paiements/non-encaisses", icon: ClockAlertIcon },
      { title: "Factures", href: "/factures", icon: FileTextIcon },
      { title: "Fournisseurs", href: "/fournisseurs", icon: TruckIcon },
    ],
  },
  {
    label: "Banque",
    items: [
      { title: "Comptes et chéquiers", href: "/comptes-bancaires", icon: LandmarkIcon },
      { title: "Rapprochement", href: "/rapprochement", icon: GitCompareArrowsIcon },
      { title: "Rapports", href: "/rapports", icon: FileBarChartIcon },
    ],
  },
  {
    label: "Paramètres",
    items: [
      { title: "Entreprise", href: "/parametres/organisation", icon: BuildingIcon },
      { title: "Membres", href: "/parametres/membres", icon: UsersIcon },
      { title: "Sécurité", href: "/parametres/securite", icon: ShieldCheckIcon },
      {
        title: "Journal d'audit",
        href: "/journal",
        icon: ScrollTextIcon,
        roles: ["admin", "manager", "accountant", "external_accountant"],
      },
    ],
  },
];

/** Sections visibles pour un rôle ; sans rôle connu, seuls les liens ouverts à tous. */
export function navigationFor(role: AppRole | null): NavSection[] {
  return navigation
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.roles || (role !== null && item.roles.includes(role))) }))
    .filter((section) => section.items.length > 0);
}

/** Lien actif : correspondance exacte, ou sous-page (sauf si un lien plus précis existe). */
export function isActiveLink(pathname: string, href: string, allHrefs: string[]) {
  if (pathname === href) {
    return true;
  }
  if (!pathname.startsWith(`${href}/`)) {
    return false;
  }
  return !allHrefs.some((other) => other !== href && other.startsWith(href) && pathname.startsWith(other));
}
