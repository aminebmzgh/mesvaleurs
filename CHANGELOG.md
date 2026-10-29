# Journal des modifications

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon
[SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Journal d'audit : écran de consultation (direction et comptabilité) avec filtres par période,
  auteur, objet et action, détail des champs modifiés (avant → après), lien vers l'objet,
  pagination et export CSV ; journalisation étendue aux invitations, banques ajoutées,
  relevés importés et correspondances de colonnes.
- Navigation : liens réservés à certains rôles.
- Virements fournisseurs : nouveau mode de paiement (compte débité, référence, date, factures
  réglées), saisi déjà débité ou en attente puis marqué débité ou rapproché ; référence
  affichée partout à la place du numéro de formule.
- Chèques et LCN rejetés (loi 71-24) : déclaration du rejet (motif, date), compte à rebours de
  régularisation (délai paramétrable, un mois par défaut), alerte sur le tableau de bord,
  régularisation par nouvelle provision, chèque ou LCN de remplacement, virement ou autre
  moyen ; détection des libellés d'impayé dans le rapprochement ; mention « informations
  indicatives ».
- Assistant de paiement : émission sans provision suffisante soumise à confirmation explicite.
- Chèques de garantie : émission depuis le chéquier (objet, restitution prévue), sans
  règlement de facture ; rappel de restitution et indicateur « risque d'encaissement » sur le
  tableau de bord ; clôture par restitution, destruction ou encaissement ; exclus des
  prévisions.
- Report d'échéance des LCN : nouvelle échéance, motif et accord du fournisseur, historique
  des reports (échéance initiale affichée), action tracée au journal d'audit.
- Journal d'audit : rejets, régularisations et reports désignés par le numéro du paiement.
- Chèques non encaissés depuis longtemps : liste au-delà d'un délai (30 à 120 jours, réglable
  dans les paramètres de l'entreprise, 60 par défaut), contact du fournisseur, relance par
  e-mail pré-rédigée, total bloqué ; alerte sur le tableau de bord.
- Lettre d'accompagnement de règlement (PDF A4) : en-tête de l'entreprise avec logo,
  destinataire, référence, factures réglées (réglé, reste dû), paiements joints, total en
  chiffres et en lettres, mention du reste à payer, signataire, zone « Reçu par » ; modèles
  standard, LCN échelonnées, acompte et solde ; double exemplaire ; partage depuis un mobile.
  Case « Imprimer la lettre d'accompagnement » dans l'assistant, selon le fournisseur.
- Bordereau de remise des valeurs au fournisseur (PDF, deux exemplaires, accusé de réception).
- Paramètres de l'entreprise : logo (PNG ou JPEG).
- Modèles de lettres de l'entreprise (paramètres, direction) : copie d'un modèle intégré,
  objet, corps et formule de politesse avec variables, aperçu immédiat ; proposés sur la page
  de chaque lot.
- Oppositions : déclaration sur un chèque ou une LCN en circulation (perte, vol, utilisation
  frauduleuse, redressement ou liquidation du porteur, selon la valeur), ou sur des formules
  vierges d'un chéquier ou d'un carnet (perte ou vol) ; récépissé de déclaration ; le
  paiement passe « en opposition » et ses factures redeviennent à payer ; les formules
  vierges en opposition ne sont plus attribuées à l'émission ni comptées comme restantes ou
  sautées ; liste des oppositions sur la page du compte ; action tracée au journal d'audit.
- Courriers types (PDF, en-tête de l'entreprise) : lettre d'opposition à la banque, demande de
  prorogation d'une LCN (zone « Bon pour accord »), demande de relevé de compte au
  fournisseur (factures non soldées selon vos livres), lettre de relance d'un client (saisie
  libre) ; page « Courriers types ».
- Modèles de lettres : un modèle de l'entreprise pour chaque type de courrier, avec ses
  variables et son aperçu ; le premier modèle d'un type remplace le modèle intégré par défaut.
- Stock de chéquiers : seuil d'alerte « presque épuisé » réglable dans les paramètres de
  l'entreprise (3 à 20 formules, 5 par défaut) ; stock calculé par compte et par type de
  carnet (un carnet qui s'achève n'alerte pas si un autre carnet en service prend le relais) ;
  avertissement dans l'assistant de paiement quand le lot fait passer le stock sous le seuil ;
  lien vers le compte depuis l'alerte du tableau de bord.
- Inventaire d'un carnet : chaque formule utilisée, annulée (avec le motif), en opposition,
  restante ou non attribuée, avec le paiement correspondant.
- Double signature et plafonds : seuil de validation par formule et plafond journalier de
  l'entreprise (paramètres), plafond journalier par membre (page Membres) et par fournisseur
  (fiche fournisseur) ; au-delà, le lot est préparé (numéros réservés, paiements en brouillon,
  factures non réglées) et doit être validé par un gestionnaire ou un administrateur autre
  que le préparateur avant toute impression ou lettre ; refus avec motif (paiements annulés,
  numéros conservés) ; page « Lots à valider », alerte sur le tableau de bord, validations et
  refus tracés au journal d'audit.
- Impression complémentaire : zones de talon (bénéficiaire, montant, date, échéance,
  factures réglées) pour les formules avec souche ; mention « NON ENDOSSABLE » et barrement
  (deux traits parallèles) imprimés si le modèle prévoit leur zone, visibles dans l'éditeur et
  l'impression test ; enveloppes (DL, C5, C6) avec expéditeur et destinataire, depuis la fiche
  fournisseur et la page d'un lot.
- Prévision de trésorerie sur 90 jours : solde actuel − chèques en circulation − LCN et
  virements à leur date (chèques de garantie exclus), par compte ou pour tous les comptes,
  factures à payer en option à leur échéance légale ; courbe avec infobulle (souris et
  clavier), solde à 90 jours, point bas, débits prévus jour par jour ; alerte de solde
  prévisionnel négatif, aussi sur le tableau de bord.
- Calendrier des échéances (vues mois et semaine) : LCN, dates limites des factures et
  restitutions des chèques de garantie, état payé / en attente / en retard (couleur, icône et
  libellé), totaux de la période, liste par jour sur téléphone.
- Statistiques (12 derniers mois ou année civile) : total réglé, répartition chèques / LCN /
  virements, dépenses par mois (avec tableau des valeurs) et par fournisseur, délai moyen de
  paiement par fournisseur (de la facture à la remise, pondéré par les montants).
- Exports des listes Chèques et LCN, Factures et Fournisseurs en CSV (séparateur « ; »,
  virgule décimale, accents lus par Excel), Excel (montants et dates réels) et PDF (A4
  paysage), avec les filtres affichés.
- Export comptable mensuel (Rapports) : journal des règlements fournisseurs en CSV, deux
  lignes par règlement ; comptes par défaut du plan comptable marocain (4411 fournisseurs,
  5141 banque, 4415 effets à payer), code comptable facultatif par fournisseur (compte
  auxiliaire) et par compte bancaire ; base « date de débit » ou « date d'émission » (LCN par
  les effets à payer) ; séparateur, format de date, séparateur décimal et en-tête réglables
  (Paramètres › Comptabilité, administrateur).
- Alertes : page Alertes (LCN à échoir, factures proches de la date limite légale ou en
  retard, paiements rejetés, provision insuffisante, chèques de garantie, chèques non
  encaissés, carnets presque épuisés, lots à valider), délais d'alerte des LCN et des factures
  réglables ; récapitulatif quotidien par e-mail (Resend) envoyé chaque matin par une tâche
  planifiée Vercel Cron protégée par `CRON_SECRET`, rejouable sans doublon, avec
  historique des envois ; chaque membre peut s'en désabonner. L'envoi réel attend un domaine
  vérifié (`RESEND_API_KEY` et `EMAIL_FROM`).

### Sécurité

- Paiements et lots d'impression : création, validation et suppression réservées aux
  fonctions de la base (plus d'écriture directe) ; plafond d'un fournisseur modifiable
  seulement par un gestionnaire ou un administrateur.

### Corrigé

- Rejet, régularisation, report de LCN et clôture d'un chèque de garantie : une date du jour
  saisie entre minuit et 1 h (heure du Maroc) n'est plus refusée comme « dans le futur ».

## [1.0.0] — Phase 1 : MVP

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
- Factures : saisie (HT + TVA = TTC vérifié ; TVA à 20 % et TTC calculés depuis le HT, ou HT
  et TVA depuis le TTC, modifiables), doublon refusé, liste filtrée (statut,
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
  Populaire, Crédit Agricole du Maroc, CIH Bank, Al Barid Bank, BMCI, Bank of Africa,
  Crédit du Maroc, Société Générale Maroc et Trésorerie Générale du Royaume (175 × 80 mm) ;
  LCN Attijariwafa bank, Crédit Agricole du Maroc, BMCI, Bank of Africa, Banque Populaire,
  Crédit du Maroc et Société Générale Maroc (200 × 105 mm) ; modèles génériques.
- Référentiel des banques : Trésorerie Générale du Royaume (TGR).
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
