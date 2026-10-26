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
| `pnpm test:e2e` | Tests de bout en bout (Playwright) : build + navigateur contre la base locale (`pnpm db:reset` avant pour repartir du seed ; `pnpm exec playwright install chromium` la première fois) |
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

| Environnement | Branche Git | Application | Supabase (Paris, eu-west-3) |
|---|---|---|---|
| Production | `main` | https://mesvaleurs.vercel.app | `mesvaleurs-prod` (`yqqovspjdsccfscmbeel`), sans données de démo |
| Préproduction | `develop` et toute autre branche / PR | URL de prévisualisation Vercel (protégée par l'authentification Vercel) | `mesvaleurs-preprod` (`dnaadluvwvxmzzipbrxz`), avec données de démo |

Chaque push est déployé automatiquement par Vercel. Les variables d'environnement
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` = clé *publishable*,
`SUPABASE_SERVICE_ROLE_KEY` = clé *secret*, marquée sensible) sont définies dans Vercel
par environnement. L'URL des liens envoyés par e-mail est déduite des variables système
Vercel (URL de la branche en prévisualisation), sauf si `NEXT_PUBLIC_SITE_URL` est définie.

### Appliquer une migration sur les projets distants

```bash
pnpm exec supabase link --project-ref dnaadluvwvxmzzipbrxz   # préproduction
pnpm exec supabase db push --linked
pnpm exec supabase link --project-ref yqqovspjdsccfscmbeel   # production
pnpm exec supabase db push --linked
```

Le mot de passe de chaque base est demandé (conservé hors du dépôt, dans un gestionnaire
de mots de passe). Ne jamais utiliser `--include-seed` sur la production.

### Configuration Auth et stockage

`supabase/config.toml` est la source de vérité ; les blocs `[remotes.preprod]` et
`[remotes.prod]` y surchargent l'URL du site et les redirections autorisées :

```bash
pnpm exec supabase config push --project-ref <ref>
```

Tant qu'aucun SMTP personnalisé (Resend) n'est configuré, le plan gratuit de Supabase
refuse les modèles d'e-mails personnalisés et n'envoie des e-mails qu'aux membres de
l'équipe Supabase, limités à quelques envois par heure : les inscriptions et invitations
de vrais utilisateurs nécessitent donc Resend (issue « Configurer Resend comme SMTP de
Supabase Auth »).

## Branches et contributions

- `main` : production (aucun push direct, uniquement des PR à CI verte) · `develop` : préproduction · `feat/…`, `fix/…` : une branche par sujet.
- Commits au format Conventional Commits, en français (`feat: assistant de paiement`).
- Une Pull Request par fonctionnalité ; fusion uniquement si la CI est verte.
- Mettre à jour `CHANGELOG.md` à chaque PR.
