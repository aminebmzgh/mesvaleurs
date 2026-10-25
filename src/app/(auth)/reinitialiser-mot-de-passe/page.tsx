import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

/** Atteinte après un lien de réinitialisation ou d'invitation : la session est déjà ouverte. */
export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choisir un mot de passe</CardTitle>
        <CardDescription>Ce mot de passe vous servira à vous connecter.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <AuthenticatedResetForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function AuthenticatedResetForm() {
  await requireUser();
  return <ResetPasswordForm />;
}
