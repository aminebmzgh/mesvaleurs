-- =============================================================================
-- Fondations : organisations (multi-tenant), profils, adhésions, rôles,
-- invitations, journal d'audit et fonctions d'autorisation utilisées par la RLS.
-- =============================================================================

-- Schéma non exposé par l'API REST : il contient les fonctions d'autorisation
-- `security definer`, qui ne doivent pas être appelables directement.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

-- admin : Administrateur, manager : Gestionnaire, preparer : Préparateur,
-- accountant : Comptable (lecture + exports), external_accountant : Expert-comptable externe.
create type public.app_role as enum (
  'admin',
  'manager',
  'preparer',
  'accountant',
  'external_accountant'
);

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Organisations
-- -----------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  -- Identifiants légaux marocains (optionnels)
  ice text check (ice ~ '^\d{15}$'),
  tax_id text,          -- Identifiant fiscal (IF)
  trade_register text,  -- Registre de commerce (RC)
  patente text,
  cnss text,
  address text,
  -- Ville, utilisée comme lieu d'émission par défaut des chèques et LCN
  city text,
  phone text,
  email text,
  logo_path text,
  -- Chiffre d'affaires annuel, utilisé pour la loi 69-21
  annual_revenue numeric(16, 2) check (annual_revenue >= 0),
  timezone text not null default 'Africa/Casablanca',
  -- Paramètres de l'organisation, validés côté application (Zod)
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Profils (1-1 avec auth.users)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Copie de auth.users.email (non modifiable par l'utilisateur), pour l'affichage des membres
  email text not null,
  full_name text check (length(full_name) <= 200),
  -- Fonction du signataire, imprimée sur les lettres d'accompagnement
  job_title text check (length(job_title) <= 200),
  phone text,
  locale text not null default 'fr' check (locale in ('fr', 'ar')),
  last_organization_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Création automatique du profil à l'inscription
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Report des changements d'adresse e-mail confirmés
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- L'utilisateur ne modifie que ces colonnes de son profil (pas l'e-mail ni l'identifiant)
revoke update on public.profiles from authenticated, anon;
grant update (full_name, job_title, phone, locale, last_organization_id) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Adhésions (utilisateur ↔ organisation, avec rôle)
-- -----------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  -- Permet à l'API de joindre le profil (nom, fonction) des membres
  constraint memberships_user_id_profiles_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade
);

create index memberships_user_id_idx on public.memberships (user_id);

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fonctions d'autorisation
--
-- `security definer` : elles lisent `memberships` sans repasser par sa RLS, ce
-- qui évite la récursion infinie des politiques. Elles se basent uniquement sur
-- auth.uid(), jamais sur un paramètre fourni par le client pour l'identité.
-- -----------------------------------------------------------------------------

-- Double authentification : si l'utilisateur a un facteur MFA vérifié, sa
-- session doit être de niveau aal2 pour accéder aux données.
create or replace function private.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1
      from auth.mfa_factors
      where user_id = auth.uid()
        and status = 'verified'
    );
$$;

-- L'utilisateur courant est-il membre de l'organisation ?
create or replace function private.is_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where organization_id = org_id
      and user_id = auth.uid()
  ) and private.mfa_satisfied();
$$;

-- L'utilisateur courant a-t-il l'un des rôles donnés dans l'organisation ?
create or replace function private.has_role(org_id uuid, roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where organization_id = org_id
      and user_id = auth.uid()
      and role = any (roles)
  ) and private.mfa_satisfied();
$$;

-- Variantes ensemblistes, utilisées dans les politiques RLS sous la forme
-- `organization_id in (select private.member_org_ids())` : la sous-requête non
-- corrélée n'est évaluée qu'une fois par requête, et non pour chaque ligne.
create or replace function private.member_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.memberships
  where user_id = auth.uid()
    and private.mfa_satisfied();
$$;

create or replace function private.role_org_ids(roles public.app_role[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.memberships
  where user_id = auth.uid()
    and role = any (roles)
    and private.mfa_satisfied();
$$;

-- L'utilisateur courant partage-t-il au moins une organisation avec `other_user_id` ?
create or replace function private.shares_organization(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and theirs.user_id = other_user_id
  ) and private.mfa_satisfied();
$$;

grant execute on all functions in schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Garde-fou : une organisation garde toujours au moins un administrateur
-- -----------------------------------------------------------------------------

create or replace function private.ensure_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := old.organization_id;
begin
  if old.role <> 'admin' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'admin' then
    return new;
  end if;
  -- L'organisation elle-même est en cours de suppression : rien à protéger.
  if not exists (select 1 from public.organizations where id = org_id) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1
    from public.memberships
    where organization_id = org_id
      and role = 'admin'
      and id <> old.id
  ) then
    raise exception 'L''organisation doit conserver au moins un administrateur.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger memberships_ensure_admin_remains
  before update of role or delete on public.memberships
  for each row execute function private.ensure_admin_remains();

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%@%'),
  role public.app_role not null,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

-- Une seule invitation en attente par adresse et par organisation
create unique index invitations_pending_unique_idx
  on public.invitations (organization_id, email)
  where accepted_at is null;

-- -----------------------------------------------------------------------------
-- Journal d'audit (alimenté uniquement par des triggers et des fonctions)
-- -----------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  -- insert, update, delete, ou action métier : print, reprint, cancel, manual_match…
  action text not null,
  table_name text,
  record_id uuid,
  before jsonb,
  after jsonb,
  details jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_org_created_idx on public.audit_log (organization_id, created_at desc);
create index audit_log_record_idx on public.audit_log (record_id);

-- Trigger générique : enregistre l'état avant/après de chaque modification.
-- La table auditée doit avoir les colonnes `id` (uuid) et `organization_id`
-- (ou être la table `organizations`).
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := to_jsonb(coalesce(new, old));
  org_id uuid;
begin
  if tg_table_name = 'organizations' then
    org_id := (row_data ->> 'id')::uuid;
  else
    org_id := (row_data ->> 'organization_id')::uuid;
  end if;

  -- Ligne globale (référentiel commun), ou suppression en cascade d'une
  -- organisation : rien à journaliser.
  if org_id is null
    or (tg_op = 'DELETE' and not exists (select 1 from public.organizations where id = org_id)) then
    return coalesce(new, old);
  end if;

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, before, after)
  values (
    org_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    (row_data ->> 'id')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger organizations_audit
  after update or delete on public.organizations
  for each row execute function private.audit_row_change();

create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function private.audit_row_change();

-- Journalisation d'une action métier (impression, réimpression, annulation…)
create or replace function public.log_audit_event(
  p_organization_id uuid,
  p_action text,
  p_table_name text default null,
  p_record_id uuid default null,
  p_details jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_organization_id) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, details)
  values (p_organization_id, auth.uid(), p_action, p_table_name, p_record_id, p_details);
end;
$$;

-- -----------------------------------------------------------------------------
-- Fonctions appelées par l'application (RPC)
-- -----------------------------------------------------------------------------

-- Création d'une organisation : l'utilisateur courant en devient administrateur.
create or replace function public.create_organization(p_name text, p_city text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  insert into public.organizations (name, city)
  values (trim(p_name), nullif(trim(p_city), ''))
  returning id into new_org_id;

  insert into public.memberships (organization_id, user_id, role)
  values (new_org_id, auth.uid(), 'admin');

  update public.profiles
  set last_organization_id = new_org_id
  where id = auth.uid();

  return new_org_id;
end;
$$;

-- Acceptation d'une invitation adressée à l'e-mail de l'utilisateur courant.
create or replace function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
begin
  select * into inv
  from public.invitations
  where id = p_invitation_id
    and accepted_at is null
    and expires_at > now()
    and email = lower(auth.jwt() ->> 'email')
  for update;

  if not found then
    raise exception 'Invitation introuvable ou expirée.' using errcode = 'P0002';
  end if;

  insert into public.memberships (organization_id, user_id, role)
  values (inv.organization_id, auth.uid(), inv.role)
  on conflict (organization_id, user_id) do nothing;

  update public.invitations set accepted_at = now() where id = inv.id;

  return inv.organization_id;
end;
$$;

-- Invitations en attente pour l'utilisateur courant (avec le nom de l'organisation,
-- que l'invité ne peut pas encore lire via la RLS).
create or replace function public.my_pending_invitations()
returns table (id uuid, organization_id uuid, organization_name text, role public.app_role, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.organization_id, o.name, i.role, i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.email = lower(auth.jwt() ->> 'email')
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at;
$$;

revoke execute on function public.create_organization(text, text) from anon, public;
revoke execute on function public.accept_invitation(uuid) from anon, public;
revoke execute on function public.my_pending_invitations() from anon, public;
revoke execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) from anon, public;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.my_pending_invitations() to authenticated;
grant execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

-- Organisations : lecture par les membres, modification par les administrateurs.
-- La création passe par create_organization() ; pas de suppression depuis l'API.
create policy "organizations_select_members" on public.organizations
  for select to authenticated
  using (id in (select private.member_org_ids()));

create policy "organizations_update_admins" on public.organizations
  for update to authenticated
  using (id in (select private.role_org_ids('{admin}')))
  with check (id in (select private.role_org_ids('{admin}')));

-- Profils : chacun gère le sien ; les membres d'une même organisation se voient.
create policy "profiles_select_self_or_colleagues" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_organization(id));

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Adhésions : lecture par les membres, gestion par les administrateurs.
create policy "memberships_select_members" on public.memberships
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

create policy "memberships_insert_admins" on public.memberships
  for insert to authenticated
  with check (organization_id in (select private.role_org_ids('{admin}')));

create policy "memberships_update_admins" on public.memberships
  for update to authenticated
  using (organization_id in (select private.role_org_ids('{admin}')))
  with check (organization_id in (select private.role_org_ids('{admin}')));

-- Seul le rôle d'une adhésion est modifiable (pas l'utilisateur ni l'organisation)
revoke update on public.memberships from authenticated, anon;
grant update (role) on public.memberships to authenticated;

-- Un administrateur retire des membres ; tout membre peut quitter l'organisation.
create policy "memberships_delete_admins_or_self" on public.memberships
  for delete to authenticated
  using (
    organization_id in (select private.role_org_ids('{admin}'))
    or user_id = (select auth.uid())
  );

-- Invitations : gérées par les administrateurs.
create policy "invitations_select_admins" on public.invitations
  for select to authenticated
  using (organization_id in (select private.role_org_ids('{admin}')));

create policy "invitations_insert_admins" on public.invitations
  for insert to authenticated
  with check (organization_id in (select private.role_org_ids('{admin}')));

create policy "invitations_delete_admins" on public.invitations
  for delete to authenticated
  using (organization_id in (select private.role_org_ids('{admin}')));

-- Journal d'audit : lecture seule pour la direction et la comptabilité.
-- Aucune politique d'écriture : seuls les triggers et fonctions y écrivent.
create policy "audit_log_select" on public.audit_log
  for select to authenticated
  using (
    organization_id in (
      select private.role_org_ids('{admin,manager,accountant,external_accountant}')
    )
  );
