import { InfoIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { FeatureComparison, PlanCards } from "@/components/pricing-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAiStatus } from "@/lib/ai/usage";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { PLANS, TRIAL_PLAN, trialDaysLeft } from "@/lib/billing/plans";
import { getPlanUsage } from "@/lib/billing/usage";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Abonnement" };

export default function SubscriptionPage() {
  return (
    <>
      <PageHeader title="Abonnement" description="Votre offre, votre consommation du mois et le détail des offres." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Subscription />
      </Suspense>
    </>
  );
}

async function Subscription() {
  const organization = await requireActiveOrganization();
  const [usage, ai] = await Promise.all([
    getPlanUsage(organization.organizationId),
    createClient().then((supabase) => getAiStatus(supabase, organization.organizationId)),
  ]);
  const plan = PLANS[organization.plan];
  const subscribed = PLANS[organization.subscription.plan];
  const trialLeft = trialDaysLeft(organization.subscription.trialEndsAt);
  const meters = [
    { label: "Comptes bancaires actifs", used: usage.bankAccounts, max: plan.maxBankAccounts },
    { label: "Utilisateurs (invitations en attente comprises)", used: usage.members, max: plan.maxMembers },
    { label: "Paiements créés ce mois-ci", used: usage.monthlyPayments, max: plan.maxMonthlyPayments },
    ...(ai.included ? [{ label: "Lectures et questions d'IA ce mois-ci", used: ai.used, max: ai.quota }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {trialLeft !== null && (
        <Alert>
          <SparklesIcon aria-hidden />
          <AlertTitle>
            Essai de l&apos;offre {PLANS[TRIAL_PLAN].label} : {trialLeft} jour{trialLeft > 1 ? "s" : ""} restant{trialLeft > 1 ? "s" : ""}
          </AlertTitle>
          <AlertDescription>
            Jusqu&apos;au {formatDate(organization.subscription.trialEndsAt!)}, toutes les fonctionnalités de l&apos;offre{" "}
            {PLANS[TRIAL_PLAN].label} sont ouvertes. Ensuite, votre entreprise passe à l&apos;offre {subscribed.label}, sans perte de
            données : au-delà de ses limites, rien n&apos;est supprimé, seuls les ajouts sont bloqués.
          </AlertDescription>
        </Alert>
      )}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>
            Offre {plan.label}
            {trialLeft !== null && " (essai)"}
          </CardTitle>
          <CardDescription>{plan.tagline}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {meters.map((meter) => {
              const ratio = meter.max ? Math.min(1, meter.used / meter.max) : 0;
              return (
                <div key={meter.label} className="flex flex-col gap-1.5">
                  <dt className="text-sm text-muted-foreground">{meter.label}</dt>
                  <dd className="text-sm font-medium tabular-nums">
                    {meter.used} {meter.max === null ? "· illimité" : `sur ${meter.max}`}
                  </dd>
                  {meter.max !== null && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className={cn("h-full rounded-full", ratio >= 1 ? "bg-destructive" : "bg-primary")} style={{ width: `${ratio * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>

      <Alert className="max-w-3xl">
        <InfoIcon aria-hidden />
        <AlertDescription>
          Le paiement en ligne des offres arrive bientôt. D&apos;ici là, pour passer à une offre supérieure, contactez l&apos;équipe MesValeurs.
        </AlertDescription>
      </Alert>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Les offres</h2>
        <PlanCards current={organization.plan} />
        <FeatureComparison current={organization.plan} />
      </section>
    </div>
  );
}
