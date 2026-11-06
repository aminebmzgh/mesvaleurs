import type { Metadata } from "next";
import { appConfig } from "@/lib/config";
import { LEGAL, PROCESSORS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: `Données traitées par ${appConfig.name}, finalités, hébergement et droits (loi n° 09-08).`,
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p className="text-muted-foreground">Dernière mise à jour : {LEGAL.updatedAt}</p>
      <p>
        Conformément à la loi n° 09-08 relative à la protection des personnes physiques à l&apos;égard du traitement des
        données à caractère personnel, {appConfig.name} vous informe de la manière dont vos données sont traitées.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        {LEGAL.companyName}, {LEGAL.address}. Contact : <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
      <p>
        Pour les données de leurs fournisseurs et de leurs règlements, les entreprises clientes restent responsables du
        traitement ; {appConfig.name} agit alors pour leur compte, comme sous-traitant.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li>Compte utilisateur : nom, adresse e-mail, fonction, préférences de notification.</li>
        <li>Entreprise : raison sociale, identifiants légaux (ICE, RC, IF), adresse, logo.</li>
        <li>Fournisseurs : raison sociale, identifiants légaux, coordonnées, RIB.</li>
        <li>
          Règlements : chèques, LCN, virements, factures, remises, relevés bancaires, accusés de réception et documents
          joints.
        </li>
        <li>Sécurité : journaux de connexion, adresse IP, journal d&apos;audit des actions.</li>
      </ul>

      <h2>Finalités</h2>
      <p>
        Fourniture du service : émission et impression des moyens de paiement, suivi des échéances et des encaissements,
        rapprochement bancaire, trésorerie, conformité aux délais de paiement (loi n° 69-21) et aux règles sur les
        chèques impayés (loi n° 71-24), alertes et résumés par e-mail, sécurité des comptes. Aucune donnée n&apos;est
        revendue ni utilisée à des fins publicitaires.
      </p>

      <h2>Sous-traitants et hébergement</h2>
      <ul>
        {PROCESSORS.map((processor) => (
          <li key={processor.name}>
            <strong>{processor.name}</strong> : {processor.role}. Localisation : {processor.location}.
          </li>
        ))}
      </ul>

      <h2>Transfert hors du Maroc</h2>
      <p>
        Les données sont hébergées dans l&apos;Union européenne ; certaines opérations techniques passent par les
        États-Unis (hébergement de l&apos;application et, si votre entreprise l&apos;active, intelligence artificielle).
        Ces transferts font l&apos;objet d&apos;une déclaration auprès de la Commission nationale de contrôle de la
        protection des données à caractère personnel (CNDP) : {LEGAL.cndpReceipt}.
      </p>

      <h2>Intelligence artificielle</h2>
      <p>
        L&apos;assistant et la lecture automatique des documents sont désactivés par défaut. Un administrateur peut les
        activer pour son entreprise après avoir accepté un avertissement. Les données personnelles sont masquées avant
        l&apos;envoi et le prestataire ne conserve pas les contenus traités.
      </p>

      <h2>Cookies</h2>
      <p>
        {appConfig.name} n&apos;utilise que des cookies nécessaires au fonctionnement : session de connexion et entreprise
        active. Aucun cookie publicitaire ni de mesure d&apos;audience n&apos;est déposé.
      </p>

      <h2>Durée de conservation</h2>
      <p>
        Les pièces comptables et justificatifs sont conservés 10 ans, conformément aux obligations légales. Les autres
        données sont supprimées à la clôture du compte. Les journaux de sécurité sont conservés le temps nécessaire à la
        protection du service.
      </p>

      <h2>Sécurité</h2>
      <p>
        Chiffrement des échanges, isolation des données de chaque entreprise, double authentification, rôles et
        journal d&apos;audit.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;opposition et de suppression de vos données.
        Pour l&apos;exercer, écrivez à <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. Vous pouvez
        aussi saisir la CNDP (www.cndp.ma).
      </p>
    </>
  );
}
