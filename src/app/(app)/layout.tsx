import Link from "next/link";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { OrganizationSwitcher } from "@/components/app-shell/organization-switcher";
import { UserMenu } from "@/components/app-shell/user-menu";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarMenuSkeleton, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireActiveOrganization, requireUser } from "@/lib/auth/dal";
import { PLANS, TRIAL_PLAN, trialDaysLeft } from "@/lib/billing/plans";

/**
 * Mise en page de l'espace connecté. La structure (barre latérale, en-tête) est
 * statique ; les éléments liés à la session sont chargés derrière des Suspense.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar
        access={requireActiveOrganization({ allowMissingMfa: true }).then(({ role, plan }) => ({ role, plan }))}
        header={
          <Suspense fallback={<SidebarMenuSkeleton showIcon />}>
            <SidebarOrganization />
          </Suspense>
        }
        footer={
          <Suspense fallback={<SidebarMenuSkeleton showIcon />}>
            <SidebarUser />
          </Suspense>
        }
      />
      <SidebarInset>
        <Suspense fallback={null}>
          <OfflineBanner />
        </Suspense>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ms-1" aria-label="Afficher ou masquer le menu" />
          <Separator orientation="vertical" className="me-2 h-4" />
          <span className="text-sm text-muted-foreground">Gestion des chèques et LCN</span>
          <Suspense fallback={null}>
            <TrialNotice />
          </Suspense>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function SidebarOrganization() {
  const organization = await requireActiveOrganization({ allowMissingMfa: true });
  return <OrganizationSwitcher active={organization} memberships={organization.memberships} />;
}

/** Essai en cours : jours restants, lien vers la page Abonnement. */
async function TrialNotice() {
  const organization = await requireActiveOrganization({ allowMissingMfa: true });
  const days = trialDaysLeft(organization.subscription.trialEndsAt);
  if (days === null) {
    return null;
  }
  return (
    <Link href="/parametres/abonnement" className="ms-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/15">
      Essai {PLANS[TRIAL_PLAN].label} : {days} jour{days > 1 ? "s" : ""}
    </Link>
  );
}

async function SidebarUser() {
  const user = await requireUser();
  return <UserMenu fullName={user.fullName} email={user.email} />;
}
