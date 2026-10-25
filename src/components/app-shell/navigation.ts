import {
  BanknoteIcon,
  BuildingIcon,
  FileBarChartIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  ShieldCheckIcon,
  SquarePenIcon,
  TruckIcon,
  UsersIcon,
} from "lucide-react";

export type NavItem = { title: string; href: string; icon: LucideIcon };
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
    ],
  },
];

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
