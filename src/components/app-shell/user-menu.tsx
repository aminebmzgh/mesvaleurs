"use client";

import { ChevronsUpDownIcon, LogOutIcon, MonitorIcon, MoonIcon, ShieldCheckIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { startTransition } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth/actions";
import { clearOfflinePages } from "@/lib/pwa/cache";

function initials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu({ fullName, email }: { fullName: string | null; email: string }) {
  const { theme, setTheme } = useTheme();
  const displayName = fullName || email;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />} aria-label="Menu utilisateur">
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{initials(displayName)}</AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </span>
            <ChevronsUpDownIcon className="ms-auto" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" side="top" align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/parametres/securite" />}>
                <ShieldCheckIcon aria-hidden />
                Sécurité du compte
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Apparence</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(value) => setTheme(String(value))}>
                <DropdownMenuRadioItem value="light">
                  <SunIcon aria-hidden />
                  Clair
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <MoonIcon aria-hidden />
                  Sombre
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <MonitorIcon aria-hidden />
                  Système
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => startTransition(async () => {
              await clearOfflinePages();
              await signOut();
            })}>
              <LogOutIcon aria-hidden />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
