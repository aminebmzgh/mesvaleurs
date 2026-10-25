-- =============================================================================
-- Référentiel des banques marocaines.
-- Lignes globales (organization_id null) partagées par tous, et banques ajoutées
-- par une organisation (liste modifiable).
-- =============================================================================

create table public.banks (
  id uuid primary key default gen_random_uuid(),
  -- null : banque du référentiel commun
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  short_name text,
  -- Codes banque (3 premiers chiffres du RIB), pour reconnaître la banque à partir d'un RIB.
  -- À compléter et vérifier : une même banque peut avoir plusieurs codes (ex. banques régionales).
  rib_bank_codes text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index banks_global_name_idx on public.banks (lower(name)) where organization_id is null;
create unique index banks_org_name_idx on public.banks (organization_id, lower(name)) where organization_id is not null;

create trigger banks_set_updated_at
  before update on public.banks
  for each row execute function private.set_updated_at();

alter table public.banks enable row level security;

create policy "banks_select" on public.banks
  for select to authenticated
  using (organization_id is null or organization_id in (select private.member_org_ids()));

create policy "banks_insert" on public.banks
  for insert to authenticated
  with check (organization_id in (select private.role_org_ids('{admin,manager}')));

create policy "banks_update" on public.banks
  for update to authenticated
  using (organization_id in (select private.role_org_ids('{admin,manager}')))
  with check (organization_id in (select private.role_org_ids('{admin,manager}')));

create policy "banks_delete" on public.banks
  for delete to authenticated
  using (organization_id in (select private.role_org_ids('{admin,manager}')));

-- Référentiel commun (données de référence, présentes dans tous les environnements)
insert into public.banks (name, short_name) values
  ('Attijariwafa bank', 'AWB'),
  ('Bank of Africa (BMCE)', 'BOA'),
  ('Banque Populaire', 'BP'),
  ('CIH Bank', 'CIH'),
  ('Société Générale Maroc', 'SGMA'),
  ('Crédit Agricole du Maroc', 'CAM'),
  ('BMCI', 'BMCI'),
  ('Crédit du Maroc', 'CDM'),
  ('Al Barid Bank', 'ABB'),
  ('CFG Bank', 'CFG');
