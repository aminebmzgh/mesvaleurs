-- =============================================================================
-- Modèles de lettres de l'entreprise (spec §6.4 bis et §11 bis D) : texte libre avec
-- variables, en plus des modèles intégrés à l'application. Le type de courrier
-- prépare la bibliothèque de courriers types (opposition, prorogation…).
-- =============================================================================

create type public.letter_kind as enum ('cover_letter', 'opposition', 'postponement_request', 'statement_request', 'reminder');

create table public.letter_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.letter_kind not null default 'cover_letter',
  name text not null check (length(trim(name)) between 1 and 80),
  subject text not null check (length(trim(subject)) between 1 and 200),
  body text not null check (length(body) between 1 and 4000),
  closing text not null check (length(closing) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index letter_templates_name_idx on public.letter_templates (organization_id, kind, lower(name));

create trigger letter_templates_set_updated_at
  before update on public.letter_templates
  for each row execute function private.set_updated_at();

create trigger letter_templates_audit
  after insert or update or delete on public.letter_templates
  for each row execute function private.audit_row_change();

alter table public.letter_templates enable row level security;

create policy "letter_templates_select" on public.letter_templates
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

create policy "letter_templates_insert" on public.letter_templates
  for insert to authenticated
  with check (organization_id in (select private.role_org_ids('{admin,manager}')));

create policy "letter_templates_update" on public.letter_templates
  for update to authenticated
  using (organization_id in (select private.role_org_ids('{admin,manager}')))
  with check (organization_id in (select private.role_org_ids('{admin,manager}')));

create policy "letter_templates_delete" on public.letter_templates
  for delete to authenticated
  using (organization_id in (select private.role_org_ids('{admin,manager}')));
