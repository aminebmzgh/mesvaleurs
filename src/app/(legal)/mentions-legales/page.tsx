import type { Metadata } from "next";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Mentions légales" };

// Contenu provisoire : les informations de l'éditeur sont à compléter avant la mise en production.
export default function LegalNoticePage() {
  return (
    <>
      <h1>Mentions légales</h1>
      <h2>Éditeur</h2>
      <p>
        {appConfig.name} est édité par [raison sociale], [forme juridique] au capital de [montant] DH, dont le
        siège est situé [adresse], immatriculée au registre de commerce de [ville] sous le numéro [RC], ICE
        [ICE].
      </p>
      <h2>Hébergement</h2>
      <p>
        Application hébergée par Vercel Inc. (États-Unis). Données stockées par Supabase Inc., dans un centre de
        données situé dans l&apos;Union européenne (Paris, France).
      </p>
      <h2>Contact</h2>
      <p>[adresse e-mail de contact]</p>
    </>
  );
}
