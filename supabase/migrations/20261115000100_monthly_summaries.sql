-- =============================================================================
-- Résumé mensuel par e-mail (spec §11 bis L) : le 1er de chaque mois, la tâche
-- planifiée envoie à chaque membre qui l'a choisi ce qui a été payé le mois écoulé,
-- ce qui reste à payer et les risques. Avec l'IA activée, un paragraphe rédigé par
-- l'assistant à partir des seuls chiffres (compté dans le quota d'IA).
-- =============================================================================

-- Préférence de chaque membre : activée par défaut
alter table public.memberships
  add column email_monthly_summary boolean not null default true;

create or replace function public.set_email_monthly_summary(p_organization_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.memberships
  set email_monthly_summary = p_enabled
  where organization_id = p_organization_id and user_id = auth.uid();
  if not found then
    raise exception 'Vous n''êtes pas membre de cette entreprise.' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.set_email_monthly_summary(uuid, boolean) from anon, public;
grant execute on function public.set_email_monthly_summary(uuid, boolean) to authenticated;

-- Envois : une ligne par entreprise et par mois résumé, réservée avant l'envoi
-- (tâche rejouable sans doublon ; un envoi échoué se retente). Écriture par la tâche seulement.
create table public.monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Premier jour du mois résumé
  month date not null check (extract(day from month) = 1),
  status public.alert_digest_status not null default 'pending',
  recipient_count integer not null default 0 check (recipient_count >= 0),
  with_commentary boolean not null default false,
  error text check (length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, month)
);

create trigger monthly_summaries_set_updated_at
  before update on public.monthly_summaries
  for each row execute function private.set_updated_at();

alter table public.monthly_summaries enable row level security;

create policy "monthly_summaries_select" on public.monthly_summaries
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

revoke all on public.monthly_summaries from anon, authenticated;
grant select on public.monthly_summaries to authenticated;

-- Paragraphe de l'assistant : compté dans le quota d'IA de l'entreprise
alter table public.ai_usages drop constraint ai_usages_feature_check;
alter table public.ai_usages add constraint ai_usages_feature_check check (feature in ('invoice_reading', 'assistant', 'monthly_summary'));
