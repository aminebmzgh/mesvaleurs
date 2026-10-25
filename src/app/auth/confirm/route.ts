import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Destination après vérification, selon le type de lien reçu par e-mail. */
const DESTINATIONS: Partial<Record<EmailOtpType, string>> = {
  signup: "/onboarding",
  email: "/onboarding",
  invite: "/reinitialiser-mot-de-passe",
  recovery: "/reinitialiser-mot-de-passe",
  magiclink: "/tableau-de-bord",
  email_change: "/tableau-de-bord",
};

/**
 * Vérifie le jeton des liens envoyés par e-mail (confirmation, invitation,
 * réinitialisation, lien magique) et ouvre la session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const redirectTo = (pathname: string, error?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    if (error) {
      url.searchParams.set("erreur", error);
    }
    return NextResponse.redirect(url);
  };

  if (!tokenHash || !type || !(type in DESTINATIONS)) {
    return redirectTo("/connexion", "lien-invalide");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return redirectTo("/connexion", "lien-expire");
  }

  return redirectTo(DESTINATIONS[type] ?? "/tableau-de-bord");
}
