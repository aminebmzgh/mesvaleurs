import type { Metadata } from "next";
import { appConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Politique de confidentialité" };

// Contenu provisoire, à faire valider par un juriste et à compléter avec le
// numéro de récépissé de la déclaration CNDP avant la mise en production.
export default function PrivacyPolicyPage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>
        Conformément à la loi n° 09-08 relative à la protection des personnes physiques à l&apos;égard du
        traitement des données à caractère personnel, {appConfig.name} vous informe de la manière dont vos
        données sont traitées.
      </p>
      <h2>Données collectées</h2>
      <p>
        Données de compte (nom, adresse e-mail, fonction), données de vos entreprises et de vos fournisseurs
        (raison sociale, identifiants légaux, coordonnées bancaires), données de règlement (chèques, LCN,
        factures, relevés bancaires) et journaux techniques de sécurité.
      </p>
      <h2>Finalités</h2>
      <p>
        Fourniture du service : émission et impression des moyens de paiement, rapprochement bancaire, suivi de
        trésorerie et conformité aux délais de paiement. Aucune donnée n&apos;est revendue ni utilisée à des fins
        publicitaires.
      </p>
      <h2>Transfert hors du Maroc</h2>
      <p>
        Les données sont hébergées dans l&apos;Union européenne (Paris, France). Ce transfert fait l&apos;objet
        d&apos;une déclaration auprès de la CNDP : [numéro de récépissé].
      </p>
      <h2>Durée de conservation</h2>
      <p>
        Les pièces comptables et justificatifs sont conservés 10 ans, conformément aux obligations légales. Les
        autres données sont supprimées à la clôture du compte.
      </p>
      <h2>Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;opposition et de suppression de vos
        données. Pour l&apos;exercer : [adresse e-mail du responsable du traitement].
      </p>
    </>
  );
}
