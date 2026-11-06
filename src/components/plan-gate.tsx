import { LockIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { FEATURES, type FeatureKey, hasFeature, PLANS } from "@/lib/billing/plans";

/** Fonctionnalité non comprise dans l'offre : ce qu'elle apporte et où changer d'offre. */
export function UpgradeNotice({ feature }: { feature: FeatureKey }) {
  const { label, minPlan } = FEATURES[feature];
  return (
    <EmptyState
      icon={LockIcon}
      title={`${label} : offre ${PLANS[minPlan].label}`}
      description={`Cette fonctionnalité fait partie de l'offre ${PLANS[minPlan].label} et des offres supérieures. Vos données restent intactes.`}
      action={
        <Link href="/parametres/abonnement" className={buttonVariants()}>
          Voir les offres
        </Link>
      }
    />
  );
}

/** Affiche le contenu si l'offre de l'entreprise active comprend la fonctionnalité (à placer sous Suspense). */
export async function PlanGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const organization = await requireActiveOrganization();
  return hasFeature(organization.plan, feature) ? children : <UpgradeNotice feature={feature} />;
}

/** Layout d'un dossier de pages réservé à une offre : `export default featureLayout("forecast")`. */
export function featureLayout(feature: FeatureKey) {
  return function FeatureLayout({ children }: { children: ReactNode }) {
    return (
      <Suspense fallback={null}>
        <PlanGate feature={feature}>{children}</PlanGate>
      </Suspense>
    );
  };
}
