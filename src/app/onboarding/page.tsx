import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMemberships } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import { acceptInvitation } from "@/lib/organizations/actions";
import { createClient } from "@/lib/supabase/server";
import { CreateOrganizationForm } from "./create-organization-form";

export const metadata: Metadata = { title: "Bienvenue" };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-svh flex-col items-center gap-6 bg-muted/40 px-4 py-10">
      <BrandMark />
      <main className="flex w-full max-w-lg flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <OnboardingContent />
        </Suspense>
      </main>
    </div>
  );
}

async function OnboardingContent() {
  const memberships = await getMemberships();
  const supabase = await createClient();
  const { data: invitations } = await supabase.rpc("my_pending_invitations");

  return (
    <>
      {invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations reçues</CardTitle>
            <CardDescription>Rejoignez une entreprise qui vous a invité.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{invitation.organization_name}</span>
                  <span className="text-xs text-muted-foreground">
                    <Badge variant="secondary">{ROLE_LABELS[invitation.role]}</Badge> · expire le{" "}
                    {formatDate(invitation.expires_at)}
                  </span>
                </div>
                <form action={acceptInvitation.bind(null, invitation.id)}>
                  <Button type="submit" size="sm">
                    Rejoindre
                  </Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Créer votre entreprise</CardTitle>
          <CardDescription>
            Vous en serez l&apos;administrateur. Vous pourrez compléter ICE, IF, RC et adresse dans les
            paramètres, puis inviter vos collaborateurs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrganizationForm />
        </CardContent>
      </Card>

      {memberships.length > 0 && (
        <Link href="/tableau-de-bord" className={buttonVariants({ variant: "link" })}>
          Retour au tableau de bord
        </Link>
      )}
    </>
  );
}
