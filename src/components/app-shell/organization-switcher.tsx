"use client";

import { Building2Icon, CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { OrganizationMembership } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { switchOrganization } from "@/lib/organizations/actions";
import { clearOfflinePages } from "@/lib/pwa/cache";

export function OrganizationSwitcher({
  active,
  memberships,
}: {
  active: OrganizationMembership;
  memberships: OrganizationMembership[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" aria-busy={pending} />}
            aria-label="Changer d'entreprise"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2Icon className="size-4" aria-hidden />
            </span>
            <span className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-medium">{active.organizationName}</span>
              <span className="truncate text-xs text-muted-foreground">{ROLE_LABELS[active.role]}</span>
            </span>
            <ChevronsUpDownIcon className="ms-auto" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Entreprises</DropdownMenuLabel>
              {memberships.map((membership) => (
                <DropdownMenuItem
                  key={membership.organizationId}
                  disabled={pending}
                  onClick={() => {
                    if (membership.organizationId !== active.organizationId) {
                      startTransition(async () => {
                        await clearOfflinePages();
                        await switchOrganization(membership.organizationId);
                      });
                    }
                  }}
                >
                  <span className="flex-1 truncate">{membership.organizationName}</span>
                  {membership.organizationId === active.organizationId && <CheckIcon aria-hidden />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/onboarding" />}>
              <PlusIcon aria-hidden />
              Ajouter une entreprise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
