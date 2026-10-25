#!/usr/bin/env bash
# Crée les labels, milestones (une par phase) et issues du projet à partir de SPEC.md.
# Prérequis : GitHub CLI connectée (gh auth status) et dépôt distant configuré.
# Usage : bash scripts/github-setup.sh
set -euo pipefail

repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Dépôt : $repo"

# --- Labels -------------------------------------------------------------------
label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null; }
label "phase-0" "0E8A16" "Phase 0 — Fondations"
label "phase-1" "1D76DB" "Phase 1 — MVP"
label "phase-2" "5319E7" "Phase 2 — Trésorerie et confort"
label "phase-3" "B60205" "Phase 3 — Conformité et intelligence"
label "phase-4" "FBCA04" "Phase 4 — Commercialisation"
label "mvp" "0052CC" "Indispensable au MVP"
label "bug" "D73A4A" "Comportement incorrect"
label "amélioration" "A2EEEF" "Nouvelle fonctionnalité ou amélioration"
label "sécurité" "000000" "Sécurité, RLS, données sensibles"

# --- Milestones ---------------------------------------------------------------
milestone() {
  local title="$1" description="$2"
  if ! gh api "repos/$repo/milestones?state=all" -q ".[].title" | grep -qxF "$title"; then
    gh api "repos/$repo/milestones" -f title="$title" -f description="$description" >/dev/null
  fi
}
M0="Phase 0 — Fondations"
M1="Phase 1 — MVP"
M2="Phase 2 — Trésorerie et confort"
M3="Phase 3 — Conformité et intelligence"
M4="Phase 4 — Commercialisation"
milestone "$M0" "Dépôt, CI, base de données, authentification, multi-tenant, rôles, mise en page, seed"
milestone "$M1" "Émission, impression, import CSV/Excel, rapprochement, rapport mensuel"
milestone "$M2" "Trésorerie, alertes, exports, PWA, gestion avancée des chèques et LCN"
milestone "$M3" "Loi 69-21, OCR, IA, facture électronique, archivage légal"
milestone "$M4" "Cabinets comptables, abonnements, landing page, encaissements clients, API"

# --- Issues -------------------------------------------------------------------
issue() {
  local milestone="$1" labels="$2" title="$3" body="$4"
  if gh issue list --state all --search "in:title \"$title\"" --json title -q ".[].title" | grep -qxF "$title"; then
    echo "  existe déjà : $title"
    return
  fi
  gh issue create --title "$title" --body "$body" --label "$labels" --milestone "$milestone" >/dev/null
  echo "  créée : $title"
}

echo "Phase 0"
issue "$M0" "phase-0" "Dépôt GitHub, CI et suivi du projet" "SPEC.md §3 bis. Dépôt privé, CI (lint, types, tests, build, tests RLS), modèles d'issue et de PR, labels et milestones."
issue "$M0" "phase-0,sécurité" "Schéma de base de données et RLS multi-tenant" "SPEC.md §3.2 et §5. Migrations versionnées, RLS sur toutes les tables, clés composites par organisation, tests pgTAP d'isolation."
issue "$M0" "phase-0,sécurité" "Authentification : mot de passe, lien magique, MFA, invitations" "SPEC.md §3.2. Supabase Auth, MFA TOTP (obligatoire en option pour administrateurs et gestionnaires), invitations par e-mail, modèles d'e-mails en français."
issue "$M0" "phase-0" "Mise en page générale, organisations et rôles" "SPEC.md §11.1 et §11.6. Barre latérale, changement d'organisation, paramètres entreprise, membres, sécurité, mode clair/sombre."
issue "$M0" "phase-0" "Données de démonstration" "SPEC.md §2. Seed : fournisseurs, factures, chèques, LCN, extrait bancaire d'exemple, deuxième organisation pour l'isolation."
issue "$M0" "phase-0" "Configurer Resend comme SMTP de Supabase Auth" "SPEC.md §3.1. Domaine d'envoi vérifié, SMTP personnalisé sur les projets Supabase de préproduction et de production."

echo "Phase 1"
issue "$M1" "phase-1,mvp" "Comptes bancaires et chéquiers / carnets de LCN" "SPEC.md §5 et §11 bis H. Banque, agence, RIB (validation de la clé), solde ; chéquiers avec numérotation séquentielle sans doublon."
issue "$M1" "phase-1,mvp" "Fournisseurs" "SPEC.md §9. Fiche, factures, paiements, solde dû, historique."
issue "$M1" "phase-1,mvp" "Factures fournisseurs" "SPEC.md §5 et §9. Saisie, pièce jointe, statut, reste dû, import Excel, détection de doublon."
issue "$M1" "phase-1,mvp" "Assistant de paiement et répartition des montants" "SPEC.md §6.1 et §6.2. Égal (arrondi sur le dernier), personnalisé, échelonné ; contrôles de dépassement et de provision ; tests de répartition."
issue "$M1" "phase-1,mvp" "Montant en lettres (français, 50 cas limites)" "SPEC.md §6.3. Accords de cent et vingt, « et un », traits d'union, option orthographe 1990."
issue "$M1" "phase-1,mvp" "Éditeur de modèle d'impression, calibrage et impression PDF" "SPEC.md §6.4. Zones en millimètres, décalage imprimante, impression test, impression unitaire et par lot."
issue "$M1" "phase-1,mvp" "Import de relevé Excel/CSV" "SPEC.md §7.1. Assistant de correspondance des colonnes mémorisé par banque, détection des doublons, envoi direct vers Supabase Storage."
issue "$M1" "phase-1,mvp" "Rapprochement bancaire automatique et manuel" "SPEC.md §7.2. Extraction des numéros, niveaux exact / probable / aucun, score de confiance, écran deux colonnes, 500 lignes en quelques secondes."
issue "$M1" "phase-1,mvp" "Rapport de fin de mois" "SPEC.md §7.3. Payés, en circulation, anomalies ; export PDF et Excel."
issue "$M1" "phase-1,mvp" "Tableau de bord simple" "SPEC.md §8. Solde, total en circulation, échéances LCN, factures en retard."

echo "Phase 2"
issue "$M2" "phase-2" "Import PDF texte et parseurs par banque" "SPEC.md §7.1. Architecture en plugins, parseur générique de secours."
issue "$M2" "phase-2" "Prévision de trésorerie et calendrier des échéances" "SPEC.md §8. Courbe sur 90 jours, alerte de solde négatif, vue mois/semaine."
issue "$M2" "phase-2" "Alertes e-mail et tâches planifiées" "SPEC.md §3.3 et §8. Vercel Cron protégé par secret, échéances LCN, chèques rejetés, chéquiers presque épuisés."
issue "$M2" "phase-2" "Lettre d'accompagnement et bordereau de remise" "SPEC.md §6.4 et §6.4 bis. Modèles modifiables avec variables, double exemplaire, envoi par e-mail."
issue "$M2" "phase-2" "Statistiques et exports Excel/CSV/PDF" "SPEC.md §8 et §11.2. Export comptable mensuel paramétrable."
issue "$M2" "phase-2" "Journal d'audit complet et écran de consultation" "SPEC.md §11.4."
issue "$M2" "phase-2" "Application installable (PWA)" "SPEC.md §3.1 et §11.6. Consultation hors connexion des données récentes."
issue "$M2" "phase-2" "Chèques rejetés et régularisation (loi 71-24)" "SPEC.md §11 bis B. Compte à rebours paramétrable, prévention à l'impression."
issue "$M2" "phase-2" "Chèques de garantie" "SPEC.md §11 bis C."
issue "$M2" "phase-2" "Oppositions, pertes et courriers types" "SPEC.md §11 bis D."
issue "$M2" "phase-2" "Prorogation et report des LCN" "SPEC.md §11 bis E."
issue "$M2" "phase-2" "Chèques non encaissés depuis longtemps" "SPEC.md §11 bis F."
issue "$M2" "phase-2" "Stock de chéquiers et lecture CMC7" "SPEC.md §11 bis H."
issue "$M2" "phase-2,sécurité" "Double signature et plafonds" "SPEC.md §6.2 et §11 bis I. Circuit de validation Préparateur → Gestionnaire."
issue "$M2" "phase-2" "Talons, enveloppes et mention non endossable" "SPEC.md §11 bis N."
issue "$M2" "phase-2,sécurité" "Verrouillage après échecs de connexion" "SPEC.md §11.4."

echo "Phase 3"
issue "$M3" "phase-3" "Module de conformité loi 69-21" "SPEC.md §10. Paramètres configurables, amende indicative, état trimestriel, rappels."
issue "$M3" "phase-3" "OCR des relevés scannés" "SPEC.md §3.1 et §7.1. tesseract.js dans le navigateur, écran de vérification obligatoire."
issue "$M3" "phase-3" "Saisie de factures assistée par IA et détection d'anomalies" "SPEC.md §9."
issue "$M3" "phase-3" "Rapprochement avec le relevé de compte fournisseur" "SPEC.md §9."
issue "$M3" "phase-3" "Import de relevés par e-mail" "SPEC.md §7.1."
issue "$M3" "phase-3" "Factures électroniques UBL et archivage légal" "SPEC.md §11 bis A."
issue "$M3" "phase-3" "Accusé de réception fournisseur signé" "SPEC.md §11 bis G."
issue "$M3" "phase-3" "Optimiseur de paiements" "SPEC.md §11 bis J."
issue "$M3" "phase-3" "Assistant IA intégré" "SPEC.md §11 bis L."

echo "Phase 4"
issue "$M4" "phase-4" "Espace cabinet comptable" "SPEC.md §11.1. Vue consolidée des clients."
issue "$M4" "phase-4" "Abonnements, paiement en ligne et landing page" "SPEC.md §11.5. Passerelle de paiement à valider."
issue "$M4" "phase-4" "Alertes WhatsApp" "SPEC.md §8."
issue "$M4" "phase-4" "Interface en arabe (RTL)" "SPEC.md §4."
issue "$M4" "phase-4" "Encaissements clients et portefeuille d'effets" "SPEC.md §11 bis K."
issue "$M4" "phase-4" "API REST, webhooks et connecteurs" "SPEC.md §11 bis M."
issue "$M4" "phase-4" "Portail fournisseur" "SPEC.md §11 bis G."

echo "Terminé."
