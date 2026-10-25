# Prompt global — SaaS de gestion, impression et rapprochement des chèques et LCN

> À coller tel quel dans Claude Code (ou à enregistrer comme `SPEC.md` à la racine du projet, puis demander : « Lis SPEC.md et commence par la Phase 0 »).

---

## 1. Rôle et contexte

Tu es un développeur full-stack senior. Tu vas construire de A à Z une application web SaaS, **entièrement en français**, destinée aux entreprises marocaines (TPE/PME, commerçants, grossistes) et aux cabinets comptables.

**Nom provisoire :** Lettro (doit être facilement modifiable via une variable de configuration).

**Problème résolu :** une entreprise paie ses fournisseurs par chèques et LCN (lettres de change normalisées). Une même facture est souvent réglée par plusieurs chèques/LCN. Chaque fin de mois, le gérant pointe manuellement l'extrait bancaire pour savoir quel chèque correspond à quelle facture et lesquels ne sont pas encore encaissés. L'application doit :

1. Émettre et **imprimer** les chèques et LCN directement sur les formules bancaires.
2. **Rattacher chaque chèque/LCN à sa facture** dès l'émission.
3. **Rapprocher automatiquement** les paiements avec l'extrait bancaire importé (PDF, Excel/CSV ou scan).
4. Prévoir la **trésorerie** et alerter avant les échéances.
5. Aider à la **conformité à la loi 69-21** sur les délais de paiement.

---

## 2. Méthode de travail (obligatoire)

- Travaille **par phases** (voir section 12). À la fin de chaque phase : résumé de ce qui a été fait, comment le tester, et ce qui reste.
- **Pose-moi des questions** avant toute décision structurante non couverte ici (choix d'hébergeur, fournisseur d'e-mail, passerelle de paiement…).
- Écris des **tests automatisés** pour toute la logique métier critique : répartition des montants, montant en lettres, rapprochement bancaire, calcul des délais 69-21.
- Code propre, typé, commenté en français pour la logique métier. Noms de variables et de fonctions en anglais.
- Fournis des **données de démonstration** (seed) : fournisseurs, factures, chèques, extrait bancaire exemple.
- Tiens à jour un `README.md` (installation, variables d'environnement, déploiement) et un `CHANGELOG.md`.

---

## 3. Stack technique (imposée)

**Hébergement : Vercel. Base de données, authentification et stockage : Supabase.** Ne change pas ces choix ; pour tout autre outil, propose et demande-moi avant.

### 3.1 Application
- **Front + back :** Next.js (App Router) + TypeScript, déployé sur **Vercel**
- **UI :** Tailwind CSS + shadcn/ui, design sobre et professionnel, responsive (mobile, tablette, PC)
- **Validation des données :** Zod (formulaires et API)
- **Génération PDF / impression :** positionnement précis en millimètres (pdf-lib ou CSS print `@page`)
- **Lecture de PDF :** extraction de texte (pdf.js / pdf-parse)
- **OCR (scans) :** Tesseract (tesseract.js, langue française), exécuté **dans le navigateur** pour éviter les limites des fonctions serverless ; solution de secours uniquement
- **Import Excel/CSV :** SheetJS
- **E-mails transactionnels :** Resend (aussi configuré comme SMTP personnalisé de Supabase Auth)
- **PWA :** application installable sur téléphone et PC

### 3.2 Supabase
- **Base de données :** PostgreSQL Supabase
  - Accès via **supabase-js** (`@supabase/ssr` pour Next.js) avec **types TypeScript générés** par la CLI Supabase
  - Pas de Prisma : il contourne la RLS. Si un ORM devient nécessaire, me demander avant
  - **Migrations SQL versionnées** dans `supabase/migrations`, gérées par la CLI Supabase ; seed dans `supabase/seed.sql`
  - Environnement local avec `supabase start` (Docker) pour le développement et les tests
- **Multi-tenant et sécurité : Row Level Security (RLS) activée sur TOUTES les tables**
  - Chaque table métier porte un `organization_id`
  - Table `memberships (user_id, organization_id, role)` ; politiques RLS basées sur l'appartenance et le rôle (fonctions SQL `security definer` pour éviter la récursion)
  - Tests automatisés prouvant qu'un utilisateur ne peut jamais lire ni modifier les données d'une autre organisation
  - La clé `service_role` n'est utilisée **que côté serveur** (tâches planifiées, webhooks), jamais exposée au navigateur
- **Authentification : Supabase Auth**
  - E-mail + mot de passe, lien magique en option, réinitialisation du mot de passe
  - **MFA / TOTP** (double authentification) natif Supabase, obligatoire pour les rôles Administrateur et Gestionnaire (option)
  - Invitations d'utilisateurs dans une organisation par e-mail
  - Gestion des sessions via middleware Next.js
  - Modèles d'e-mails d'authentification traduits en français
- **Stockage : Supabase Storage**
  - Buckets privés : `releves`, `factures`, `cheques-scans`, `lettres`, `modeles-impression`, `logos`
  - Chemins préfixés par `organization_id` + politiques RLS sur Storage
  - **Envoi direct du navigateur vers Supabase Storage** (URL signées) pour contourner la limite de taille des requêtes des fonctions Vercel ; le serveur ne traite ensuite que la référence du fichier
  - Liens de téléchargement signés à durée limitée
- **Logique en base :** fonctions et triggers PostgreSQL pour les règles critiques (numérotation séquentielle des chèques sans doublon, mise à jour du statut des factures, journal d'audit)
- **Temps réel (optionnel) :** Supabase Realtime pour rafraîchir le tableau de bord quand un autre utilisateur imprime ou rapproche

### 3.3 Tâches planifiées et traitements longs
- **Vercel Cron Jobs** pour les alertes quotidiennes (échéances LCN, chèques rejetés, dates limites 69-21, chéquiers presque épuisés), protégés par un secret
- Ou **pg_cron** dans Supabase pour les tâches purement SQL
- Les traitements longs (gros relevés, imports volumineux) doivent être découpés ou exécutés en tâche de fond (Supabase Edge Functions ou file d'attente), en tenant compte des limites de durée d'exécution de Vercel

### 3.4 Environnements et déploiement
- Deux projets Supabase : **développement/préproduction** et **production**
- Vercel : déploiements de prévisualisation par branche reliés au projet Supabase de préproduction, production reliée au projet de production
- Variables d'environnement documentées dans `.env.example` : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, etc.
- **Région Supabase :** me demander avant de créer le projet (choix de la région la plus proche du Maroc et impact sur la déclaration CNDP de transfert de données hors du Maroc)
- Sauvegardes : activer les sauvegardes Supabase et prévoir un export complet des données d'une organisation à la demande

---

## 3 bis. Dépôt GitHub et gestion du code

**Première action de la Phase 0 : créer le dépôt GitHub du projet.**

### Création
- Avant de créer, **demande-moi confirmation** du nom du dépôt (proposition par défaut : `lettro`) et du compte ou de l'organisation GitHub.
- Dépôt **privé**.
- Utilise la **GitHub CLI** : `gh repo create <nom> --private --source=. --remote=origin --push`.
  - Vérifie d'abord l'authentification avec `gh auth status`. Si `gh` n'est pas installé ou pas connecté, arrête-toi et donne-moi la commande exacte à lancer (`gh auth login`), sans contourner.
- Description du dépôt en français : « SaaS de gestion, impression et rapprochement bancaire des chèques et LCN pour les entreprises marocaines ».

### Contenu initial (premier commit)
- `README.md` (présentation, installation, variables d'environnement, déploiement Vercel + Supabase)
- `SPEC.md` : **ce document**, copié tel quel, pour pouvoir le relire à chaque phase
- `.gitignore` adapté à Next.js + Supabase (exclure `.env*` sauf `.env.example`, `node_modules`, `.next`, `.vercel`, `supabase/.temp`)
- `.env.example` sans aucune valeur secrète
- `CHANGELOG.md`, `LICENSE` (propriétaire, tous droits réservés — me demander si je préfère autre chose)
- Dossier `supabase/` (migrations, seed, config)
- **Aucun secret** (clés Supabase, Resend, etc.) ne doit jamais être commité. Vérifie avant chaque commit.

### Branches et commits
- `main` = production (déployée automatiquement par Vercel), protégée
- `develop` = préproduction
- Une branche par fonctionnalité : `feat/assistant-paiement`, `feat/rapprochement`, `fix/...`
- Messages de commit au format **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`), rédigés en français
- Commits petits et fréquents ; une **Pull Request** par fonctionnalité, avec description de ce qui a été fait et comment tester
- Tag de version à la fin de chaque phase (`v0.1.0` après la Phase 0, `v1.0.0` à la fin du MVP)

### Intégration continue (GitHub Actions)
- Workflow sur chaque Pull Request et push : installation, lint, vérification des types TypeScript, tests unitaires, build
- Tests RLS / isolation multi-tenant sur une base Supabase locale (`supabase start` dans le workflow)
- La PR ne peut être fusionnée que si la CI est verte

### Suivi du projet
- Créer les **Issues GitHub** à partir des phases et fonctionnalités de ce document, avec des labels (`phase-0`, `phase-1`, `mvp`, `bug`, `amélioration`) et un **Milestone par phase**
- Modèles d'issue (bug, fonctionnalité) et de Pull Request en français

### Connexion Vercel et Supabase
- Une fois le dépôt créé, donne-moi les étapes pour le relier à Vercel (import du dépôt, variables d'environnement, déploiements de prévisualisation par branche) et à Supabase (intégration GitHub pour les migrations, si je le souhaite)

---

## 4. Localisation (Maroc)

- Interface **100 % en français**. Prévoir l'architecture i18n pour ajouter l'arabe (RTL) plus tard.
- Devise : **dirham (MAD)**, format `1 234,56 DH` (espace pour les milliers, virgule décimale).
- Dates : `jj/mm/aaaa`, fuseau horaire `Africa/Casablanca`.
- Identifiants d'entreprise : ICE, IF, RC, patente, CNSS (champs optionnels sur l'entreprise et les fournisseurs).
- RIB marocain sur 24 chiffres, avec validation de la clé.
- Banques préconfigurées : Attijariwafa bank, Bank of Africa (BMCE), Banque Populaire, CIH Bank, Société Générale Maroc, Crédit Agricole du Maroc, BMCI, Crédit du Maroc, Al Barid Bank, CFG Bank. Liste modifiable.

---

## 5. Modèle de données (à affiner)

- **Organisation** (multi-entreprise / multi-tenant) : raison sociale, ICE, IF, RC, adresse, ville (lieu d'émission par défaut), logo, chiffre d'affaires annuel (pour la loi 69-21)
- **Utilisateur** et **Rôle** : Administrateur, Gestionnaire, Préparateur, Comptable (lecture + exports), Expert-comptable externe
- **CompteBancaire** : banque, agence, RIB, solde initial, solde actuel, devise
- **Chéquier / Carnet de LCN** : compte, type, premier numéro, dernier numéro, numéro suivant disponible, modèle d'impression associé
- **Fournisseur** : raison sociale, nom à imprimer (bénéficiaire), ICE, RIB, contact, e-mail, téléphone, délai de paiement convenu (jours), notes
- **Facture** : fournisseur, numéro, date d'émission, date de livraison, montant HT, TVA, TTC, délai convenu, date limite légale calculée, statut (non payée, partiellement payée, payée, contestée), pièce jointe (scan/photo)
- **Paiement** (chèque ou LCN) : type, numéro, compte, facture(s) liée(s), bénéficiaire, montant, date d'émission, date d'échéance (LCN), date de remise au fournisseur, date de débit bancaire, statut, image/scan du chèque, lot d'impression
- **Statuts d'un paiement :** brouillon, émis (imprimé), remis au fournisseur, payé (débité), rejeté, annulé, perdu, en opposition
- **ImportRelevé** : compte, période, fichier source, format (PDF texte, scan, Excel, CSV), date d'import, statut
- **LigneRelevé** : date opération, date valeur, libellé, référence, débit, crédit, numéro de chèque/LCN extrait, paiement rapproché, score de confiance, statut (rapproché auto, à confirmer, non rapproché, ignoré)
- **ModèleImpression** : banque, type (chèque/LCN), dimensions, liste des zones (champ, x, y, largeur, police, taille, alignement), décalage imprimante global
- **JournalAudit** : qui, quoi, quand, avant/après
- **Notification** et **Paramètres**

Un paiement peut régler **une ou plusieurs factures**, et une facture peut être réglée par **plusieurs paiements** (relation plusieurs-à-plusieurs avec le montant affecté).

---

## 6. Fonctionnalités — Module Émission et impression

### 6.1 Assistant de paiement (écran principal)
1. Choisir **Chèque** ou **LCN**
2. Choisir le **compte bancaire / chéquier** (le prochain numéro disponible s'affiche)
3. Choisir le **fournisseur** (recherche rapide, création à la volée)
4. Choisir **une ou plusieurs factures** non soldées, ou en saisir une nouvelle (numéro, date, montant)
5. Saisir le **montant à régler** (par défaut le reste dû)
6. Saisir le **nombre de chèques/LCN**
7. **Mode de répartition :**
   - Égal : montant ÷ nombre ; l'écart d'arrondi (centimes) va sur le dernier
   - Personnalisé : montants saisis à la main, avec contrôle que la somme est égale au total
   - Échelonné : échéances automatiques (ex. 30/60/90 jours) pour les LCN, dates modifiables
8. **Aperçu** de chaque chèque/LCN (rendu visuel de la formule)
9. Bouton **Imprimer** : génère le PDF, enregistre tout en base, attribue les numéros, passe les paiements en « émis »

### 6.2 Règles de gestion
- Numérotation séquentielle par chéquier, **aucun doublon** possible, avertissement si un numéro est sauté
- **Annulation** d'un chèque (gâché, erreur d'impression) : le numéro reste dans l'historique avec le motif
- **Réimpression** possible, tracée dans le journal d'audit
- Contrôle du dépassement : alerte si le montant dépasse le reste dû de la facture
- Alerte **provision insuffisante** si le solde prévisionnel devient négatif à la date d'échéance
- Option **circuit de validation** : le Préparateur prépare, le Gestionnaire valide avant impression

### 6.3 Montant en lettres (critique)
- Conversion automatique en français correct : « Mille deux cent trente-quatre dirhams et cinquante-six centimes »
- Respecter les règles : accord de « cent » et « vingt » (quatre-vingts, deux cents), « et un », traits d'union, « mille » invariable, « million(s) »
- Option orthographe rectifiée de 1990 (traits d'union partout) dans les paramètres
- Batterie de tests unitaires couvrant au moins 50 cas limites (0,01 ; 80 ; 81 ; 200 ; 201 ; 1 000 000 ; etc.)

### 6.4 Moteur d'impression et calibrage
- **Éditeur visuel de modèle** : image de fond de la formule (photo/scan importé), zones déplaçables à la souris (montant chiffres, montant lettres sur 1 ou 2 lignes, bénéficiaire, lieu, date, échéance, tiré, domiciliation, RIB, etc.)
- Coordonnées en **millimètres**, police et taille réglables par zone
- **Décalage imprimante global** (X/Y) pour compenser chaque imprimante
- **Impression test sur papier blanc** avec la formule en fond pour superposer et vérifier
- Montant en chiffres encadré de `#` ou `***` pour éviter les falsifications (option)
- Impression unitaire ou **par lot**
- Option : générer un **bordereau de remise** pour le fournisseur (liste des chèques/LCN, numéros, montants, échéances, factures réglées)

### 6.4 bis Lettre d'accompagnement de règlement
- Case à cocher **« Imprimer la lettre d'accompagnement »** dans l'assistant de paiement, cochée par défaut (réglable par fournisseur et dans les paramètres).
- Impression sur **papier A4 à en-tête de l'entreprise**, dans le même lot que les chèques/LCN (ou séparément si l'imprimante utilise un bac différent).
- Contenu pré-rempli automatiquement :
  - en-tête de l'entreprise (logo, raison sociale, adresse, ICE, IF, RC) ;
  - fournisseur destinataire (raison sociale, adresse, ICE) ;
  - lieu et date, référence interne du règlement ;
  - objet : « Règlement de facture(s) » ;
  - tableau des **factures réglées** : numéro, date, montant TTC, montant réglé, reste dû ;
  - tableau des **chèques/LCN joints** : type, numéro, banque, montant, date d'échéance ;
  - **total réglé** en chiffres et en lettres ;
  - formule de politesse, nom et fonction du signataire, zone de signature et cachet ;
  - zone **« Reçu par »** (nom, date, signature) pour l'accusé de réception papier.
- **Modèles de lettre modifiables** (texte libre avec variables : {fournisseur}, {factures}, {total}, {total_lettres}, etc.), plusieurs modèles possibles (standard, LCN échelonnées, acompte, solde).
- Variante **acompte / paiement partiel** : mention automatique du reste à payer.
- Génération en **PDF**, archivée avec le règlement, envoyable par e-mail ou WhatsApp au fournisseur en un clic.
- Option **double exemplaire** : un pour le fournisseur, un copie à conserver et à faire signer.

### 6.5 Spécificités LCN
- Champs : tireur, tiré, bénéficiaire, montant, date de création, lieu de création, date d'échéance, domiciliation bancaire, RIB
- Suivi des échéances et de leur présentation

---

## 7. Fonctionnalités — Module Rapprochement bancaire

### 7.1 Import de relevé
- Formats acceptés, par ordre de fiabilité :
  1. **Excel/CSV** exporté depuis la banque (assistant de correspondance des colonnes, mémorisé par banque)
  2. **PDF texte** téléchargé depuis la banque en ligne
  3. **PDF scanné / photo** → OCR, puis **écran de vérification obligatoire**
- **Analyseurs dédiés par banque** (architecture en plugins : un parseur par format de banque), avec un parseur générique de secours
- **Import par e-mail** (phase ultérieure) : adresse dédiée par organisation ; l'utilisateur transfère l'e-mail de la banque et le relevé est traité automatiquement
- Détection des **doublons** de lignes et de relevés déjà importés

### 7.2 Algorithme de rapprochement
- Extraire le numéro de chèque/LCN des libellés (motifs du type `CHQ`, `CHEQUE`, `CH N°`, `LCN`, `EFFET`, `ECH`, etc.), en normalisant les zéros initiaux
- Niveaux de correspondance :
  - **Exact** : numéro + montant identiques → rapprochement automatique
  - **Probable** : numéro identique mais montant différent, ou montant identique et numéro proche → à confirmer
  - **Aucun** : ligne inconnue → à traiter
- **Score de confiance** affiché
- Écran de rapprochement en deux colonnes (relevé ↔ paiements en attente), validation en un clic, rapprochement manuel par glisser-déposer
- Après validation : le paiement passe en « payé », la date de débit est enregistrée, la facture est mise à jour
- Gestion des **chèques rejetés** (impayés) et de la remise en circulation

### 7.3 Rapport de fin de mois
- Chèques/LCN payés ce mois, groupés par facture et par fournisseur
- Chèques/LCN **en circulation** (émis mais non débités), avec leur ancienneté
- Anomalies : montants différents, chèques débités inconnus, numéros manquants
- Export PDF et Excel

---

## 8. Fonctionnalités — Trésorerie et tableau de bord

- **Tableau de bord** : solde bancaire, total en circulation, échéances LCN des 7/30 jours, factures en retard, dernières opérations
- **Prévision de trésorerie** : solde actuel − chèques en circulation − LCN à échoir, courbe sur 90 jours, alerte en cas de solde prévisionnel négatif
- **Calendrier** des échéances (vue mois/semaine), code couleur : payé, en attente, en retard
- **Alertes** (e-mail et dans l'application ; WhatsApp en phase ultérieure) : LCN arrivant à échéance dans X jours (configurable), provision insuffisante, facture proche de la date limite légale, chèque en circulation depuis plus de X jours
- **Statistiques** : dépenses par mois et par fournisseur, délai moyen de paiement par fournisseur, répartition chèques/LCN

---

## 9. Fonctionnalités — Fournisseurs et factures

- Fiche fournisseur : informations, factures, paiements, **solde dû**, historique
- **Import de factures** depuis Excel
- **Saisie assistée par IA** (phase ultérieure) : photo ou PDF de la facture → pré-remplissage du fournisseur, numéro, date, HT/TVA/TTC, avec validation de l'utilisateur
- **Détection d'anomalies** : facture en double (même fournisseur + même numéro), montant inhabituel par rapport à l'historique du fournisseur, facture déjà soldée
- **Rapprochement avec le relevé de compte fournisseur** : import du relevé du fournisseur et comparaison avec nos données
- Statut **contestée** pour une facture (exclue des calculs de pénalités)

---

## 10. Fonctionnalités — Conformité loi 69-21 (délais de paiement)

**Important :** les taux, seuils et délais légaux doivent être des **paramètres configurables** dans une table d'administration, jamais codés en dur, car ils évoluent (le taux directeur de Bank Al-Maghrib notamment). Ajoute un avertissement dans l'interface : « Calculs indicatifs — à valider par votre expert-comptable ».

- Calcul de la **date limite légale** de chaque facture à partir de sa date d'émission et du délai applicable (60 jours par défaut, délai convenu si renseigné, plafond légal configurable)
- **Date de paiement retenue** : paramétrable (date de remise du chèque, date d'échéance de la LCN ou date de débit)
- Indicateurs : factures dans les délais, proches de l'échéance légale, en retard
- **Calcul indicatif de l'amende** pour les factures payées hors délai (formule paramétrable : taux de base + majoration par mois ou fraction de mois de retard, seuil minimum de montant de facture)
- **État trimestriel** des factures payées hors délai ou impayées : références des factures, fournisseur, ICE, montants, modes et références de paiement, nombre de mois de retard, montant de l'amende
- Export Excel/PDF de cet état pour l'expert-comptable
- Rappel avant chaque date limite de déclaration trimestrielle

---

## 11. Fonctionnalités transverses

### 11.1 Multi-entreprise et cabinets comptables
- Un utilisateur peut appartenir à plusieurs organisations et basculer de l'une à l'autre
- Espace **cabinet comptable** : vue consolidée de tous ses clients
- Plusieurs comptes bancaires par organisation

### 11.2 Exports
- Excel, CSV et PDF pour toutes les listes
- Export comptable mensuel (journal des règlements fournisseurs) compatible avec les logiciels courants (format paramétrable)

### 11.3 Pièces justificatives
- Photo/scan de chaque chèque avant remise, attachée au paiement
- Pièce jointe de la facture
- Stockage sécurisé des fichiers

### 11.4 Sécurité et données
- Isolation stricte des données entre organisations (vérifiée par des tests)
- Double authentification, sessions sécurisées, verrouillage après plusieurs échecs
- **Journal d'audit** complet (impression, réimpression, annulation, modification de montant, rapprochement manuel)
- Sauvegardes automatiques quotidiennes, export complet des données par l'utilisateur
- Conformité **loi 09-08 (CNDP)** : mentions légales, politique de confidentialité, consentement, droit d'accès et de suppression
- Aucune donnée sensible dans les URL ni dans les logs

### 11.5 Abonnement SaaS (phase ultérieure)
- Offres : Gratuit (1 compte bancaire, volume limité de chèques/mois), Pro, Business, Cabinet
- Limites appliquées selon l'offre, page de facturation, période d'essai
- Passerelle de paiement compatible Maroc (à me demander avant de choisir)
- Page d'accueil marketing (landing page) en français avec tarifs

### 11.6 Expérience utilisateur
- Raccourcis clavier pour l'assistant de paiement
- Recherche globale (fournisseur, numéro de facture, numéro de chèque, montant)
- Mode clair/sombre
- **Onboarding guidé** : création de l'entreprise → compte bancaire → chéquier → calibrage d'impression → premier paiement
- États vides explicites, messages d'erreur clairs en français
- Fonctionnement **PWA**, consultation hors connexion des données récentes

---

## 11 bis. Fonctionnalités complémentaires

### A. Facturation électronique DGI (factures fournisseurs)
- Le Maroc déploie progressivement la facture électronique obligatoire, au format structuré **UBL (XML)** et validée par la plateforme de la DGI.
- **Import des factures électroniques reçues** (fichiers UBL/XML) : création automatique de la facture (fournisseur, ICE, numéro, date, HT, TVA, TTC, échéance), sans ressaisie.
- Contrôle de cohérence : ICE du fournisseur, numéro unique, totaux.
- Architecture prête pour une future connexion API à la plateforme DGI, notamment pour le statut de paiement des factures. Ne rien implémenter côté DGI avant validation des spécifications officielles ; prévoir une couche d'intégration isolée.
- **Archivage légal** des factures et justificatifs sur 10 ans, non modifiables, avec recherche instantanée.

### B. Chèques rejetés et loi 71-24 (chèques sans provision)
- Statut **rejeté** avec motif (provision insuffisante, signature, opposition, irrégularité…).
- Dès qu'un rejet est détecté (relevé ou saisie manuelle) : **alerte immédiate** et **compte à rebours de régularisation**. Le délai doit être paramétrable ; il est d'un mois par défaut selon la loi 71-24, à faire valider par un juriste.
- Suivi de la régularisation : nouvelle provision, nouveau chèque de remplacement, paiement par virement, date de régularisation.
- **Prévention** : blocage ou double confirmation à l'impression si le solde prévisionnel à la date de présentation est insuffisant.
- Avertissement dans l'interface : « Informations indicatives, ne constituent pas un conseil juridique ».

### C. Chèques de garantie
- Type de paiement **« chèque de garantie »** (remis à un fournisseur sans intention d'encaissement immédiat) : non comptabilisé dans le règlement de la facture, mais suivi à part.
- Date de restitution prévue, rappel pour récupérer le chèque, statut restitué / encaissé / détruit.
- Exclusion de ces chèques des prévisions de règlement, mais inclusion dans un indicateur de **risque d'encaissement**.

### D. Oppositions, pertes et courriers types
- Déclaration de **perte ou vol** d'un chèque ou d'un chéquier → statut « en opposition », génération d'une **lettre d'opposition** pré-remplie pour la banque (PDF).
- Bibliothèque de **courriers types** pré-remplis : lettre d'opposition, demande de prorogation d'une LCN, lettre d'accompagnement de règlement, demande de relevé de compte au fournisseur, lettre de relance (pour les clients).
- Modèles modifiables par l'utilisateur, avec en-tête de l'entreprise.

### E. Prorogation et report des LCN
- Demande de **report d'échéance** d'une LCN : ancienne et nouvelle échéance, motif, accord du fournisseur, historique des reports.
- Recalcul automatique de la prévision de trésorerie et de l'état 69-21.

### F. Chèques non encaissés depuis longtemps
- Liste des chèques **émis mais non encaissés** au-delà d'un délai paramétrable (ex. 30, 60, 90 jours), avec contact direct du fournisseur.
- Proposition d'action : relancer le fournisseur, faire opposition, réémettre.
- Ces montants restent bloqués dans la trésorerie prévisionnelle tant qu'ils ne sont pas réglés.

### G. Accusé de réception fournisseur
- À la remise des chèques/LCN, le fournisseur (ou son livreur) **signe sur la tablette ou le téléphone** : nom, CIN facultative, signature, date et heure, photo des chèques remis.
- Génération d'un **reçu PDF** envoyable par e-mail ou WhatsApp.
- La date de remise signée sert de preuve de la date de paiement (utile pour la loi 69-21).
- Option : **lien de suivi fournisseur** (portail en lecture seule) où le fournisseur voit les règlements émis à son nom et peut télécharger le bordereau.

### H. Gestion des chéquiers (stock)
- Alerte **« chéquier presque épuisé »** (seuil paramétrable, ex. 5 formules restantes) pour commander un nouveau chéquier à temps.
- Scan du premier chèque d'un nouveau chéquier avec la caméra : lecture de la **ligne CMC7** (numéro de chèque, code banque) par OCR pour pré-remplir le chéquier.
- Inventaire : formules utilisées, annulées, restantes.

### I. Double signature et plafonds
- Règles d'approbation par montant : ex. au-delà de X DH, validation par deux personnes avant impression.
- Plafond par utilisateur, par fournisseur ou par jour.
- Historique des validations dans le journal d'audit.

### J. Optimiseur de paiements
- Proposition automatique d'un **plan de paiement** des factures en attente, qui tient compte :
  - du solde et de la trésorerie prévisionnelle,
  - des dates limites légales (loi 69-21),
  - des pénalités potentielles,
  - des priorités fixées par l'utilisateur (fournisseurs stratégiques).
- Résultat : « Payer ces factures cette semaine, programmer ces LCN à 30/60 jours ». L'utilisateur valide, puis l'assistant de paiement est pré-rempli.

### K. Encaissements clients (deuxième sens)
- Saisie des **chèques et LCN reçus des clients** : client, facture de vente, montant, banque du tireur, numéro, échéance.
- **Portefeuille d'effets à recevoir** et **bordereau de remise en banque** imprimable.
- Suivi des **impayés clients** et des rejets, relances automatiques, score de risque par client.
- Suivi des LCN remises **à l'escompte** (date, banque, frais).
- Rapprochement des crédits du relevé bancaire avec les remises.
- Trésorerie prévisionnelle complète : entrées clients + sorties fournisseurs.

### L. Assistant IA intégré
- Questions en langage naturel en français (et darija en phase ultérieure) : « Combien je dois encore à X ? », « Quels chèques ne sont pas encore passés ? », « Quelles factures risquent une amende ce trimestre ? »
- Réponses fondées uniquement sur les données de l'organisation, avec liens vers les écrans concernés.
- Résumé mensuel automatique envoyé par e-mail : ce qui a été payé, ce qui reste, les risques.

### M. Intégrations
- **API REST** documentée + **webhooks** (paiement émis, paiement débité, chèque rejeté).
- Connecteurs d'export/import vers les logiciels de gestion courants (Sage, Odoo, etc.) — format paramétrable.
- Import des fournisseurs et factures depuis Excel ou depuis un autre logiciel.

### N. Impression complémentaire
- Prise en charge des chèques **avec ou sans talon** (souche) ; impression du talon avec fournisseur, facture et montant.
- Impression d'**enveloppes** (expéditeur/destinataire) depuis le carnet d'adresses fournisseurs.
- Impression de la **mention « non endossable »** / barrement en option, si prévu par le modèle de formule.

---

## 12. Plan de développement par phases

**Phase 0 — Fondations**
Création du dépôt GitHub (section 3 bis), CI GitHub Actions, issues et milestones, initialisation du projet, stack, base de données, authentification, multi-tenant, rôles, mise en page générale, seed de démonstration.

**Phase 1 — MVP (priorité absolue)**
- Comptes bancaires, chéquiers, fournisseurs, factures
- Assistant de paiement complet avec répartition
- Montant en lettres + tests
- Éditeur de modèle d'impression + calibrage + impression PDF
- Import de relevé **Excel/CSV** + rapprochement automatique et manuel
- Rapport de fin de mois (payés / en circulation / anomalies)
- Tableau de bord simple

**Phase 2 — Trésorerie et confort**
Import PDF texte et parseurs par banque, prévision de trésorerie, calendrier, alertes e-mail, bordereau de remise, statistiques, exports, journal d'audit complet, PWA.
Chèques rejetés et compte à rebours de régularisation (11 bis B), chèques de garantie (C), oppositions et courriers types (D), report des LCN (E), chèques non encaissés (F), stock de chéquiers (H), double signature (I), talons et enveloppes (N).

**Phase 3 — Conformité et intelligence**
Module loi 69-21, OCR des scans, saisie de factures par IA, détection d'anomalies, rapprochement avec le relevé fournisseur, import de relevés par e-mail.
Import des factures électroniques UBL et archivage légal (11 bis A), accusé de réception fournisseur signé (G), optimiseur de paiements (J), assistant IA (L).

**Phase 4 — Commercialisation**
Espace cabinet comptable, abonnements et paiement en ligne, landing page, alertes WhatsApp, préparation de l'arabe.
Encaissements clients et portefeuille d'effets (11 bis K), API et webhooks, connecteurs (M), portail fournisseur.

---

## 13. Critères de qualité

- Tests unitaires sur la répartition, le montant en lettres, l'extraction des numéros de chèque, le rapprochement et le calcul 69-21
- Tests d'intégration sur le parcours complet : émission → impression → import du relevé → rapprochement → rapport
- Tests d'isolation multi-tenant
- Performance : un relevé de 500 lignes doit être rapproché en quelques secondes
- Accessibilité de base (contrastes, navigation clavier, libellés)
- Aucune erreur dans la console du navigateur en production

---

**Pour commencer :** confirme que tu as bien compris le projet, liste les questions éventuelles, propose l'arborescence du projet et le schéma de base de données, puis attaque la **Phase 0**.
