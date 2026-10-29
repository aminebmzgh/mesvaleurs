-- =============================================================================
-- Alertes par e-mail (spec §3.3 et §8) : chaque matin, la tâche planifiée (Vercel
-- Cron) envoie à chaque membre qui l'a choisi un récapitulatif des alertes de son
-- entreprise : LCN à échoir, chèques rejetés, provision insuffisante, factures
-- proches de la date limite légale, chèques non encaissés, carnets presque épuisés.
-- =============================================================================

-- Récapitulatif quotidien par e-mail : activé par défaut, chaque membre le désactive
-- pour lui-même (set_email_alerts)
alter table public.memberships
  add column email_alerts boolean not null default true;

create or replace function public.set_email_alerts(p_organization_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.memberships
  set email_alerts = p_enabled
  where organization_id = p_organization_id and user_id = auth.uid();
  if not found then
    raise exception 'Vous n''êtes pas membre de cette entreprise.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.set_email_alerts(uuid, boolean) from anon, public;
grant execute on function public.set_email_alerts(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Envois du récapitulatif : une ligne par entreprise et par jour, réservée avant
-- l'envoi (la tâche peut être relancée sans doublon ; un envoi échoué se retente).
-- Écriture par la tâche planifiée seulement (clé service_role).
-- -----------------------------------------------------------------------------
create type public.alert_digest_status as enum (
  'pending',
  'sent',
  'no_alerts',
  'no_recipients',
  'disabled',
  'failed'
);

create table public.alert_digests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  digest_date date not null,
  status public.alert_digest_status not null default 'pending',
  alert_count integer not null default 0 check (alert_count >= 0),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  error text check (length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, digest_date)
);

create trigger alert_digests_set_updated_at
  before update on public.alert_digests
  for each row execute function private.set_updated_at();

alter table public.alert_digests enable row level security;

create policy "alert_digests_select" on public.alert_digests
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

revoke insert, update, delete on public.alert_digests from anon, authenticated;
