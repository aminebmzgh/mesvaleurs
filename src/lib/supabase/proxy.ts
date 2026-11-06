import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/** Pages accessibles sans être connecté. */
const PUBLIC_PATHS = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/auth",
  "/mentions-legales",
  "/confidentialite",
  // Référencement de la page d'accueil
  "/robots.txt",
  "/sitemap.xml",
  // Application installable : page « Pas de connexion » gardée par le service worker
  "/hors-ligne",
  // Tâches planifiées : protégées par CRON_SECRET dans la route
  "/api/cron",
  // Webhook Resend (relevés reçus par e-mail) : authentifié par sa signature
  "/api/inbound",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Rafraîchit la session Supabase à chaque requête et redirige les visiteurs non
 * connectés vers la page de connexion. Contrôle « optimiste » uniquement :
 * l'autorisation réelle est faite par la couche d'accès aux données et la RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Ne rien exécuter entre la création du client et getClaims() : c'est cet appel
  // qui rafraîchit le jeton si nécessaire.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Conserver les cookies de session éventuellement rafraîchis
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Page d'accueil publique ; un utilisateur connecté va directement à son tableau de bord
  if (pathname === "/") {
    return isAuthenticated ? redirectTo("/tableau-de-bord") : response;
  }

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    url.searchParams.set("suivant", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
