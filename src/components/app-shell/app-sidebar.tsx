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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { AppRole } from "@/types/app";
import { isActiveLink, navigation, navigationFor } from "./navigation";

const allHrefs = navigation.flatMap((section) => section.items.map((item) => item.href));

/**
 * Barre latérale. L'en-tête (organisation) et le pied (utilisateur) dépendent de
 * la session : ils sont rendus côté serveur et passés en props. Le rôle (promesse
 * résolue derrière un Suspense) masque les liens réservés à certains rôles.
 */
export function AppSidebar({ header, footer, role }: { header: ReactNode; footer: ReactNode; role: Promise<AppRole> }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>{header}</SidebarHeader>
      <SidebarContent>
        {/* Le chemin courant est une donnée de requête sur les routes dynamiques :
            la navigation est d'abord rendue sans lien actif, puis mise en évidence. */}
        <Suspense fallback={<NavigationLinks pathname={null} role={null} />}>
          <ActiveNavigationLinks role={role} />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ActiveNavigationLinks({ role }: { role: Promise<AppRole> }) {
  return <NavigationLinks pathname={usePathname()} role={use(role)} />;
}

function NavigationLinks({ pathname, role }: { pathname: string | null; role: AppRole | null }) {
  return navigationFor(role).map((section, index) => (
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
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
