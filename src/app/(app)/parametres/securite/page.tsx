import { ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { MfaSettings } from "./mfa-settings";

export const metadata: Metadata = { title: "Sécurité" };

export default function SecurityPage() {
  return (
    <>
      <PageHeader title="Sécurité du compte" description="Protégez l'accès à vos données bancaires." />
      <Suspense fallback={<Skeleton className="h-48 w-full max-w-2xl rounded-xl" />}>
        <Security />
      </Suspense>
    </>
  );
}

async function Security() {
  // Page accessible même si la double authentification exigée n'est pas encore active
  const organization = await requireActiveOrganization({ allowMissingMfa: true });

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {organization.mfaRequired && (
        <Alert>
          <ShieldAlertIcon aria-hidden />
          <AlertTitle>Double authentification obligatoire</AlertTitle>
          <AlertDescription>
            {organization.organizationName} exige la double authentification pour votre rôle. Activez-la pour
            accéder aux données.
          </AlertDescription>
        </Alert>
      )}
      <MfaSettings />
    </div>
  );
}
