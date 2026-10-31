import {
  BanknoteIcon,
  BellIcon,
  BookOpenCheckIcon,
  BuildingIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  ChartLineIcon,
  ClockAlertIcon,
  FileBarChartIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  HourglassIcon,
  LandmarkIcon,
  LetterTextIcon,
  ListOrderedIcon,
  LayoutDashboardIcon,
  MailIcon,
  ScrollTextIcon,
  ScaleIcon,
  type LucideIcon,
  ShieldCheckIcon,
  SparklesIcon,
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
    items: [
      { title: "Tableau de bord", href: "/tableau-de-bord", icon: LayoutDashboardIcon },
      { title: "Alertes", href: "/alertes", icon: BellIcon },
      { title: "Assistant IA", href: "/assistant", icon: SparklesIcon },
    ],
  },
  {
    label: "Paiements",
    items: [
      { title: "Nouveau paiement", href: "/paiements/nouveau", icon: SquarePenIcon },
      { title: "Chèques et LCN", href: "/paiements", icon: BanknoteIcon },
      { title: "Lots à valider", href: "/paiements/a-valider", icon: HourglassIcon, roles: ["admin", "manager", "preparer"] },
      { title: "Non encaissés", href: "/paiements/non-encaisses", icon: ClockAlertIcon },
      { title: "Plan de paiement", href: "/paiements/optimiseur", icon: ListOrderedIcon },
      { title: "Factures", href: "/factures", icon: FileTextIcon },
      { title: "Délais de paiement", href: "/conformite", icon: ScaleIcon },
      { title: "Fournisseurs", href: "/fournisseurs", icon: TruckIcon },
      { title: "Courriers types", href: "/courriers", icon: LetterTextIcon },
    ],
  },
  {
    label: "Banque",
    items: [
      { title: "Comptes et chéquiers", href: "/comptes-bancaires", icon: LandmarkIcon },
      { title: "Prévision de trésorerie", href: "/tresorerie", icon: ChartLineIcon },
      { title: "Calendrier", href: "/calendrier", icon: CalendarDaysIcon },
      { title: "Rapprochement", href: "/rapprochement", icon: GitCompareArrowsIcon },
      { title: "Rapports", href: "/rapports", icon: FileBarChartIcon },
      { title: "Statistiques", href: "/statistiques", icon: ChartColumnIcon },
    ],
  },
  {
    label: "Paramètres",
    items: [
      { title: "Entreprise", href: "/parametres/organisation", icon: BuildingIcon },
      { title: "Membres", href: "/parametres/membres", icon: UsersIcon },
      { title: "Sécurité", href: "/parametres/securite", icon: ShieldCheckIcon },
      { title: "Modèles de lettres", href: "/parametres/lettres", icon: MailIcon, roles: ["admin", "manager"] },
      {
        title: "Comptabilité",
        href: "/parametres/comptabilite",
        icon: BookOpenCheckIcon,
        roles: ["admin", "manager", "accountant", "external_accountant"],
      },
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
