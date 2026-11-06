import Link from "next/link";
import { SALES_EMAIL } from "@/lib/billing/plans";
import { appConfig } from "@/lib/config";

/** Pied de page des pages publiques (accueil, pages légales). */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {appConfig.name} · <a href={`mailto:${SALES_EMAIL}`} className="hover:underline">{SALES_EMAIL}</a>
        </p>
        <nav aria-label="Informations légales" className="flex gap-4">
          <Link href="/mentions-legales" className="hover:underline">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="hover:underline">
            Confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}
