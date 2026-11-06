import "server-only";
import { NextResponse } from "next/server";
import { type ActiveOrganization, requireActiveOrganization } from "@/lib/auth/dal";
import { type FeatureKey, hasFeature, upgradeMessage } from "./plans";

/** Message d'erreur d'une Server Action quand l'offre ne comprend pas la fonctionnalité, sinon null. */
export function planError(organization: Pick<ActiveOrganization, "plan">, feature: FeatureKey): string | null {
  return hasFeature(organization.plan, feature) ? null : upgradeMessage(feature);
}

/** Route Handler : réponse 403 si l'offre de l'entreprise active ne comprend pas la fonctionnalité, sinon null. */
export async function planRefusal(feature: FeatureKey): Promise<NextResponse | null> {
  const organization = await requireActiveOrganization();
  return hasFeature(organization.plan, feature) ? null : new NextResponse(upgradeMessage(feature), { status: 403 });
}
