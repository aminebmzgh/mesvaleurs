# Journal des modifications

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon
[SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Déploiement : projets Supabase de préproduction et de production (Paris), projet Vercel
  relié au dépôt (production sur `main`, prévisualisations reliées à la préproduction).
- Surcharges de configuration Auth par environnement (`[remotes.*]` dans `config.toml`).
- Comptes bancaires : création, modification, archivage ; RIB vérifié (clé), unique par
  entreprise ; solde courant initialisé et recalé sur le solde d'ouverture.
- Chéquiers et carnets de LCN : plage de numéros (zéros initiaux conservés), formules
  restantes et annulées, alerte « presque épuisé » (5 formules), archivage.
- Base : aucun chevauchement de numéros entre carnets d'un même compte, plage figée dès
  qu'un numéro est utilisé, prochain numéro qui ne peut pas reculer.
- Saisie des montants au format marocain (« 1 234,56 ») et calculs en centimes.
- Fournisseurs : liste avec recherche (raison sociale, nom imprimé, ICE), création,
  modification, archivage ; ICE unique par entreprise ; fiche avec reste à payer, montants
  en circulation, encaissés et contestés, factures (réglé / encaissé) et paiements.
- Factures : saisie (HT + TVA = TTC vérifié), doublon refusé, liste filtrée (statut,
  fournisseur, numéro) avec totaux, fiche avec paiements rattachés, contestation,
  suppression ; pièce jointe envoyée directement du navigateur vers Supabase Storage et
  consultée par lien temporaire.
- Base : date limite légale calculée (délai de la facture, sinon du fournisseur, sinon
  délai légal par défaut, plafonné), montants « réglé » / « encaissé » et statut maintenus
  par triggers ; paramètres légaux dans la table `legal_settings` (jamais codés en dur).
- Montant en lettres en français (accords de cent et vingt, « et un », mille invariable,
  millions et milliards, « de dirhams »), option orthographe rectifiée de 1990 dans les
  paramètres de l'entreprise ; 85 cas testés.
- Assistant de paiement : chèque ou LCN, chéquier avec prochain numéro, fournisseur et
  factures (création à la volée), montant par défaut = reste dû, répartition en parts
  égales (écart d'arrondi sur la dernière) ou personnalisée, échéancier de LCN
  (30/60/90 jours, modifiable), montant en lettres, aperçu des formules, alertes de
  dépassement (à confirmer) et de provision insuffisante.
- Émission atomique en base (`issue_payments`) : carnet verrouillé, numéros à la suite,
  affectations recalculées côté serveur, lot d'impression, journal d'audit.
- Chèques et LCN : liste filtrée (statut, type, numéro) avec ancienneté, remise au
  fournisseur, annulation avec motif (le numéro reste dans l'historique) ; page du lot.
- Base : cycle de vie des paiements contrôlé (transitions autorisées), montant, numéro et
  bénéficiaire figés après émission.

- Tests de bout en bout Playwright (connexion, isolation, comptes et chéquiers, lecture
  seule du comptable), exécutés dans la CI contre une base Supabase locale.

### Corrigé

- Les formulaires ne se vident plus quand la validation échoue (réinitialisation
  automatique des formulaires par React 19) : composant `ActionForm`.

### Modifié

- L'URL des liens envoyés par e-mail est déduite des variables système Vercel.
- Stockage vectoriel désactivé dans `config.toml` (fonction payante, inutilisée).

## [0.1.0] — Phase 0 : fondations

### Ajouté

- Projet Next.js 16 (App Router, TypeScript, Cache Components), Tailwind CSS 4, shadcn/ui
  avec propriétés CSS logiques pour l'arabe (RTL) à venir.
- Schéma Supabase : organisations, profils, adhésions et rôles, invitations, banques
  marocaines, comptes bancaires, chéquiers et carnets de LCN, modèles d'impression,
  fournisseurs, factures, paiements, affectations paiement ↔ facture, lots d'impression,
  imports et lignes de relevés, journal d'audit.
- Row Level Security sur toutes les tables, clés étrangères composites par organisation,
  double authentification imposée au niveau de la base, buckets de stockage privés par
  organisation.
- Tests pgTAP d'isolation multi-tenant et de rôles ; tests unitaires (formats, validation,
  redirections, navigation).
- Authentification : mot de passe, lien magique, réinitialisation, double authentification
  TOTP (obligatoire en option pour administrateurs et gestionnaires), invitations ; modèles
  d'e-mails en français.
- Espace connecté : barre latérale, changement d'entreprise, tableau de bord simple,
  paramètres entreprise, membres et sécurité, mode clair/sombre.
- Double suivi du règlement des factures : « réglée » (paiements émis, `amount_paid`) et
  « encaissée » (paiements débités, `amount_cashed`).
- Validation du RIB marocain (clé modulo 97), testée sur des RIB réels.
- Données de démonstration et relevé bancaire CSV d'exemple.
- CI GitHub Actions, modèles d'issue et de PR, script de création des issues et milestones.
