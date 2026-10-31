-- =============================================================================
-- Intelligence artificielle (saisie de factures assistée) : chaque appel au
-- modèle est inscrit ici, pour le quota mensuel de l'entreprise et la trace de
-- qui a envoyé quoi (sans le contenu envoyé). L'activation et le quota sont dans
-- organizations.settings (désactivée par défaut, activée par un administrateur).
-- =============================================================================

create table public.ai_usages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  -- Fonction de l'application à l'origine de l'appel
  feature text not null check (feature in ('invoice_reading')),
  model text,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  -- Coût annoncé par OpenRouter, en dollars
  cost numeric(12, 6) check (cost >= 0),
  succeeded boolean,
  created_at timestamptz not null default now()
);

create index ai_usages_organization_created_idx on public.ai_usages (organization_id, created_at);

alter table public.ai_usages enable row level security;

-- Consultation par les membres (consommation du mois) ; écriture par le serveur seulement
create policy "ai_usages_select" on public.ai_usages
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

grant select on public.ai_usages to authenticated;

-- Réserve un appel si le quota du mois (UTC) n'est pas atteint : renvoie l'identifiant de
-- l'appel inscrit, ou null. Verrou par entreprise : deux appels simultanés ne dépassent pas le quota.
create or replace function public.reserve_ai_usage(
  p_organization_id uuid,
  p_user_id uuid,
  p_feature text,
  p_monthly_quota integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
  usage_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai_usages:' || p_organization_id::text, 0));
  select count(*) into used
  from public.ai_usages
  where organization_id = p_organization_id
    and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  if used >= p_monthly_quota then
    return null;
  end if;
  insert into public.ai_usages (organization_id, user_id, feature)
  values (p_organization_id, p_user_id, p_feature)
  returning id into usage_id;
  return usage_id;
end;
$$;

revoke execute on function public.reserve_ai_usage(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, uuid, text, integer) to service_role;
