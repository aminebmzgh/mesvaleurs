"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/forms";
import { OtpCodeInput } from "@/components/otp-code-input";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { translateAuthError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

export function MfaVerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const verify = (value: string) => {
    startTransition(async () => {
      setError(undefined);
      const supabase = createClient();
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((f) => f.status === "verified");
      if (listError || !factor) {
        setError("Aucun facteur de double authentification n'est configuré sur ce compte.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: value,
      });
      if (verifyError) {
        setError(translateAuthError(verifyError));
        setCode("");
        return;
      }
      router.replace("/tableau-de-bord");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormMessage state={{ error }} />
      <OtpCodeInput value={code} onChange={setCode} onComplete={verify} disabled={pending} />
      <Button onClick={() => verify(code)} disabled={pending || code.length !== 6} className="w-full">
        {pending && <Loader2Icon className="animate-spin" aria-hidden />}
        Vérifier
      </Button>
      <form action={signOut} className="text-center">
        <Button type="submit" variant="link" size="sm">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
