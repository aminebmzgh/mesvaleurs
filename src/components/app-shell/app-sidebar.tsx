"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";
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
import { isActiveLink, navigation } from "./navigation";

const allHrefs = navigation.flatMap((section) => section.items.map((item) => item.href));

/**
 * Barre latérale. L'en-tête (organisation) et le pied (utilisateur) dépendent de
 * la session : ils sont rendus côté serveur et passés en props.
 */
export function AppSidebar({ header, footer }: { header: ReactNode; footer: ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>{header}</SidebarHeader>
      <SidebarContent>
        {/* Le chemin courant est une donnée de requête sur les routes dynamiques :
            la navigation est d'abord rendue sans lien actif, puis mise en évidence. */}
        <Suspense fallback={<NavigationLinks pathname={null} />}>
          <ActiveNavigationLinks />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ActiveNavigationLinks() {
  return <NavigationLinks pathname={usePathname()} />;
}

function NavigationLinks({ pathname }: { pathname: string | null }) {
  return navigation.map((section, index) => (
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
