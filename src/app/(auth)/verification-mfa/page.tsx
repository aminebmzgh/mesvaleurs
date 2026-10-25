import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaVerifyForm } from "./mfa-verify-form";

export const metadata: Metadata = { title: "Double authentification" };

export default function MfaVerificationPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Double authentification</CardTitle>
        <CardDescription>
          Saisissez le code à 6 chiffres affiché par votre application d&apos;authentification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MfaVerifyForm />
      </CardContent>
    </Card>
  );
}
