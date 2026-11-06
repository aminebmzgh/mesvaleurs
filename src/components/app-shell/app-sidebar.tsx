"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, use } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { FEATURES, hasFeature, type PlanId, PLANS } from "@/lib/billing/plans";
import type { AppRole } from "@/types/app";
import { isActiveLink, navigation, navigationFor } from "./navigation";

const allHrefs = navigation.flatMap((section) => section.items.map((item) => item.href));

/**
 * Barre latérale. L'en-tête (organisation) et le pied (utilisateur) dépendent de
 * la session : ils sont rendus côté serveur et passés en props. Le rôle et l'offre (promesse
 * résolue derrière un Suspense) masquent les liens réservés à certains rôles et signalent
 * l'offre requise par les autres.
 */
export type SidebarAccess = { role: AppRole; plan: PlanId };

export function AppSidebar({ header, footer, access }: { header: ReactNode; footer: ReactNode; access: Promise<SidebarAccess> }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>{header}</SidebarHeader>
      <SidebarContent>
        {/* Le chemin courant est une donnée de requête sur les routes dynamiques :
            la navigation est d'abord rendue sans lien actif, puis mise en évidence. */}
        <Suspense fallback={<NavigationLinks pathname={null} access={null} />}>
          <ActiveNavigationLinks access={access} />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ActiveNavigationLinks({ access }: { access: Promise<SidebarAccess> }) {
  return <NavigationLinks pathname={usePathname()} access={use(access)} />;
}

function NavigationLinks({ pathname, access }: { pathname: string | null; access: SidebarAccess | null }) {
  return navigationFor(access?.role ?? null).map((section, index) => (
    <SidebarGroup key={section.label ?? index}>
      {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {section.items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={pathname !== null && isActiveLink(pathname, item.href, allHrefs)}
                tooltip={item.title}
                render={<Link href={item.href} />}
              >
                <item.icon aria-hidden />
                <span>{item.title}</span>
              </SidebarMenuButton>
              {item.feature && access && !hasFeature(access.plan, item.feature) && (
                <SidebarMenuBadge className="text-muted-foreground">{PLANS[FEATURES[item.feature].minPlan].label}</SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
