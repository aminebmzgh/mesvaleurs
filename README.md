# MesValeurs

SaaS de gestion, d'impression et de rapprochement bancaire des chèques et LCN pour les
entreprises marocaines : émission et impression sur les formules bancaires, rattachement aux
factures, rapprochement automatique avec les relevés, prévision de trésorerie et aide à la
conformité à la loi 69-21.

Cahier des charges : [SPEC.md](SPEC.md) · Architecture et schéma : [docs/architecture.md](docs/architecture.md)

## Stack

Next.js 16 (App Router, TypeScript) sur Vercel · Supabase (PostgreSQL, Auth, Storage) ·
Tailwind CSS 4 + shadcn/ui · Zod · Vitest · pgTAP.

## Prérequis

- Node.js 22 ou plus récent
- pnpm (`npm install -g pnpm`)
- Docker Desktop, pour la base Supabase locale

## Installation

```bash
pnpm install
pnpm db:start                 # démarre Supabase en local, applique migrations et seed
cp .env.example .env.local    # puis renseigner les clés affichées par db:start
pnpm dev                      # http://localhost:3000
```

Comptes de démonstration (mot de passe `Demo1234`) :

| E-mail | Rôle | Entreprise |
|---|---|---|
| admin@demo.ma | Administrateur | Atlas Distribution SARL |
| gestionnaire@demo.ma | Gestionnaire | Atlas Distribution SARL |
| preparateur@demo.ma | Préparateur | Atlas Distribution SARL |
| comptable@demo.ma | Comptable | Atlas Distribution SARL |
| souss@demo.ma | Administrateur | Souss Négoce SARL |

Les e-mails envoyés en local (confirmation, invitation, réinitialisation) sont visibles sur
http://127.0.0.1:54324.

## Scripts

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement |
| `pnpm build` | Build de production |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Vérification des types TypeScript |
| `pnpm test` | Tests unitaires (Vitest) |
| `pnpm db:start` / `db:stop` | Démarre / arrête Supabase en local |
| `pnpm db:reset` | Recrée la base locale (migrations + seed) |
| `pnpm db:test` | Tests pgTAP : RLS, rôles, isolation multi-tenant |
| `pnpm db:lint` | Analyse des fonctions SQL |
| `pnpm db:types` | Régénère `src/types/database.ts` depuis la base locale |

Nouvelle migration : `pnpm exec supabase migration new <nom>`, puis `pnpm db:reset`,
`pnpm db:test` et `pnpm db:types`.

## Variables d'environnement

| Variable | Où | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | public | Nom affiché (défaut : MesValeurs) |
| `NEXT_PUBLIC_SITE_URL` | public | URL publique, utilisée dans les liens des e-mails |
| `NEXT_PUBLIC_SUPABASE_URL` | public | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Clé anon (ou publishable) Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **serveur** | Clé service_role : invitations, tâches planifiées. Jamais exposée au navigateur |
| `RESEND_API_KEY` | **serveur** | E-mails transactionnels (Phase 2) |
| `CRON_SECRET` | **serveur** | Protection des tâches planifiées (Phase 2) |

## Déploiement

Deux projets Supabase en région **Paris (eu-west-3)** : préproduction et production.

### Supabase (pour chaque projet)

1. Créer le projet en région `eu-west-3`.
2. Lier et appliquer les migrations :
   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```
   Le seed de démonstration n'est **pas** appliqué par `db push` ; ne pas le charger en production.
3. Authentication > URL Configuration : `Site URL` = URL Vercel, ajouter `<URL>/**` aux redirections.
4. Authentication > Email Templates : reprendre les modèles de `supabase/templates/`
   (ou `pnpm exec supabase config push`).
5. Authentication > Providers > Email : confirmation obligatoire, mot de passe de 8 caractères
   minimum avec lettres et chiffres ; activer MFA TOTP.
6. Authentication > SMTP : configurer Resend comme serveur SMTP personnalisé.
7. Database > Backups : vérifier les sauvegardes quotidiennes (et le PITR en production).

### Vercel

1. Importer le dépôt GitHub dans Vercel (framework Next.js détecté automatiquement).
2. Variables d'environnement :
   - **Production** : clés du projet Supabase de production, `NEXT_PUBLIC_SITE_URL` = domaine de production.
   - **Preview** : clés du projet Supabase de préproduction.
3. La branche `main` est déployée en production ; chaque branche et PR obtient un
   déploiement de prévisualisation relié à la préproduction.

## Branches et contributions

- `main` : production (protégée) · `develop` : préproduction · `feat/…`, `fix/…` : une branche par sujet.
- Commits au format Conventional Commits, en français (`feat: assistant de paiement`).
- Une Pull Request par fonctionnalité ; fusion uniquement si la CI est verte.
- Mettre à jour `CHANGELOG.md` à chaque PR.
