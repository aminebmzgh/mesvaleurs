"use client";

import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormMessage } from "@/components/forms";
import { OtpCodeInput } from "@/components/otp-code-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { translateAuthError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

type Enrollment = { factorId: string; qrCode: string; secret: string };

/** Activation et désactivation de la double authentification (TOTP). */
export function MfaSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setVerifiedFactorId(data?.totp.find((factor) => factor.status === "verified")?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Chargement initial de l'état des facteurs depuis Supabase Auth
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const startEnrollment = () =>
    startTransition(async () => {
      setError(undefined);
      const supabase = createClient();
      // Supprime une tentative d'activation inachevée, qui bloquerait la nouvelle
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const factor of factors?.all ?? []) {
        if (factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Application d'authentification",
      });
      if (enrollError || !data) {
        setError(translateAuthError(enrollError));
        return;
      }
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    });

  const confirmEnrollment = (value: string) =>
    startTransition(async () => {
      if (!enrollment) {
        return;
      }
      setError(undefined);
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code: value,
      });
      if (verifyError) {
        setError(translateAuthError(verifyError));
        setCode("");
        return;
      }
      setEnrollment(null);
      setCode("");
      await refresh();
      toast.success("Double authentification activée.");
      router.refresh();
    });

  const disable = () =>
    startTransition(async () => {
      if (!verifiedFactorId) {
        return;
      }
      if (!window.confirm("Désactiver la double authentification ? Votre compte sera moins protégé.")) {
        return;
      }
      const supabase = createClient();
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId });
      if (unenrollError) {
        toast.error(translateAuthError(unenrollError));
        return;
      }
      // Rafraîchit la session pour revenir au niveau aal1
      await supabase.auth.refreshSession();
      await refresh();
      toast.success("Double authentification désactivée.");
      router.refresh();
    });

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Double authentification
          {verifiedFactorId ? <Badge>Activée</Badge> : <Badge variant="outline">Désactivée</Badge>}
        </CardTitle>
        <CardDescription>
          En plus du mot de passe, un code à 6 chiffres généré par une application (Google Authenticator,
          Microsoft Authenticator…) est demandé à chaque connexion.
        </CardDescription>
      </CardHeader>

      {enrollment && (
        <CardContent className="flex flex-col gap-4">
          <FormMessage state={{ error }} />
          <ol className="flex list-decimal flex-col gap-2 ps-5 text-sm">
            <li>Scannez ce QR code avec votre application d&apos;authentification.</li>
            <li>Saisissez le code à 6 chiffres affiché pour confirmer.</li>
          </ol>
          <div className="flex flex-col items-center gap-2">
            {/* QR code fourni par Supabase sous forme d'image SVG (data URI) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qrCode} alt="QR code d'activation" className="size-48 rounded-lg bg-white p-2" />
            <p className="text-center text-xs text-muted-foreground">
              Saisie manuelle : <code className="break-all font-mono">{enrollment.secret}</code>
            </p>
          </div>
          <OtpCodeInput value={code} onChange={setCode} onComplete={confirmEnrollment} disabled={pending} />
        </CardContent>
      )}

      {!enrollment && error && (
        <CardContent>
          <FormMessage state={{ error }} />
        </CardContent>
      )}

      <CardFooter className="justify-end gap-2 border-t pt-4">
        {enrollment ? (
          <>
            <Button variant="ghost" onClick={() => setEnrollment(null)} disabled={pending}>
              Annuler
            </Button>
            <Button onClick={() => confirmEnrollment(code)} disabled={pending || code.length !== 6}>
              {pending && <Loader2Icon className="animate-spin" aria-hidden />}
              Confirmer
            </Button>
          </>
        ) : verifiedFactorId ? (
          <Button variant="destructive" onClick={disable} disabled={pending}>
            Désactiver
          </Button>
        ) : (
          <Button onClick={startEnrollment} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <ShieldCheckIcon aria-hidden />}
            Activer
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
