import type { Metadata } from "next";
import Link from "next/link";
import { appConfig } from "@/lib/config";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: `Éditeur, hébergement et contact de ${appConfig.name}.`,
};

export default function LegalNoticePage() {
  return (
    <>
      <h1>Mentions légales</h1>
      <p className="text-muted-foreground">Dernière mise à jour : {LEGAL.updatedAt}</p>

      <h2>Éditeur</h2>
      <p>
        {appConfig.name} est un service en ligne édité par {LEGAL.companyName}, {LEGAL.legalForm} au capital de{" "}
        {LEGAL.capital}, dont le siège est situé {LEGAL.address}, immatriculée au registre de commerce de{" "}
        {LEGAL.registry}, ICE {LEGAL.ice}.
      </p>
      <p>Directeur de la publication : {LEGAL.publicationManager}.</p>

      <h2>Contact</h2>
      <p>
        Par e-mail : <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
      </p>

      <h2>Hébergement</h2>
      <ul>
        <li>Application hébergée par Vercel Inc. (États-Unis).</li>
        <li>
          Données hébergées par Supabase Inc., dans un centre de données de l&apos;Union européenne (Paris, France).
        </li>
      </ul>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom {appConfig.name}, son logo, ses textes, ses écrans et son code sont protégés. Toute reproduction, même
        partielle, sans autorisation écrite de l&apos;éditeur est interdite. Les données saisies par les clients restent
        leur propriété.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>, conformément à la loi n° 09-08.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Les présentes mentions sont régies par le droit marocain. Tout litige relève des tribunaux compétents du ressort
        du siège de l&apos;éditeur.
      </p>
    </>
  );
}
