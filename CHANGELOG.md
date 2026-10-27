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
- Impression des chèques et LCN : PDF au millimètre (une page par formule, pdf-lib),
  montant encadré (#…#), montant en lettres réparti sur 2 ou 3 lignes selon la largeur
  réelle du texte, police réduite puis signalée si un texte déborde, décalage imprimante.
- Modèles par défaut relevés sur des formules réelles : chèques Attijariwafa bank, Banque
  Populaire, Crédit Agricole du Maroc, CIH Bank (175 × 80 mm) ; LCN Attijariwafa bank et
  Crédit Agricole du Maroc (200 × 105 mm) ; modèles génériques.
- Éditeur visuel de modèle : scan de la formule en fond, zones déplaçables à la souris ou
  au clavier (0,5 / 0,1 mm), largeur, police, alignement, options ; aperçu avec les mêmes
  métriques de police que le PDF ; impression test sur papier blanc avec le scan en fond.
- Modèle d'impression par carnet (sinon modèle par défaut de la banque) ; impression et
  réimpression d'un lot tracées dans le journal d'audit.
- Import des relevés Excel (.xlsx, .xls) et CSV : lecture dans le navigateur (SheetJS),
  détection de l'en-tête, correspondance des colonnes mémorisée par banque, dates (y compris
  Excel) et montants au format marocain, encodage UTF-8 ou Windows-1252, aperçu et erreurs
  par ligne ; fichier d'origine envoyé directement vers Supabase Storage ; doublons de
  relevés et de lignes écartés ; solde du compte mis à jour.
- Rapprochement bancaire : extraction des numéros de chèques et LCN des libellés (CHQ,
  CHEQUE, CH N°, LCN, EFFET, ECH…), rapprochement automatique (numéro + montant), propositions
  à confirmer (numéro identique et montant différent, montant identique et numéro proche)
  avec score de confiance ; écran deux colonnes : confirmation en un clic, association
  manuelle par sélection ou glisser-déposer, rapprochement défait, lignes ignorées ; le
  paiement passe en « débité » et la facture en « encaissée ».
- Import de factures depuis Excel ou CSV : colonnes reconnues, TTC calculé depuis HT + TVA,
  cohérence contrôlée, fournisseur reconnu par ICE puis par raison sociale (formes
  juridiques ignorées), fournisseurs inconnus créés en option, factures déjà saisies
  ignorées, erreurs signalées ligne par ligne.
- Rapport de fin de mois : chèques et LCN débités groupés par fournisseur avec les factures
  réglées, paiements en circulation avec leur ancienneté, anomalies (écarts de montant,
  débits inconnus, numéros sautés dans les carnets, annulations du mois) ; filtre par
  compte, navigation de mois en mois ; exports Excel (montants numériques, dates réelles)
  et PDF paginé.
- Tableau de bord : solde bancaire, montant en circulation, solde prévisionnel, reste à
  payer, LCN à échoir sous 7 et 30 jours, factures en retard (date limite légale), dernières
  opérations bancaires ; alertes de provision insuffisante et de carnet presque épuisé.
- Date d'annulation des paiements renseignée et protégée par la base.

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
