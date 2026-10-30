import { WifiOffIcon } from "lucide-react";
import type { Metadata } from "next";
import { BrandMark } from "@/components/brand";
import { ReloadButton } from "./reload-button";

export const metadata: Metadata = { title: "Hors connexion" };

/** Page affichée sans connexion quand la page demandée n'a pas été consultée récemment. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <BrandMark />
      <WifiOffIcon className="size-10 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Pas de connexion</h1>
        <p className="text-sm text-muted-foreground">
          Cette page n&apos;a pas été consultée récemment sur cet appareil : elle n&apos;est pas disponible hors connexion.
          Les pages ouvertes ces 7 derniers jours restent consultables.
        </p>
      </div>
      <ReloadButton />
    </main>
  );
}
