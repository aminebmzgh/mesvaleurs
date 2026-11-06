-- =============================================================================
-- Offres et abonnements (#43) : offre de chaque entreprise, essai de 14 jours de
-- l'offre Business, limites appliquées par la base (comptes bancaires actifs,
-- utilisateurs, paiements du mois) et double signature réservée aux offres Business
-- et Cabinet. Le reste des fonctionnalités par offre est contrôlé par l'application
-- (src/lib/billing/plans.ts).
-- =============================================================================

create table public.subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business', 'cabinet')),
  -- Essai : offre Business jusqu'à cette date, puis l'offre `plan`
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

alter table public.subscriptions enable row level security;

-- Consultation par les membres ; écriture par le serveur seulement (clé de service)
create policy "subscriptions_select" on public.subscriptions
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- Durée de l'essai offert à chaque nouvelle entreprise
create or replace function private.start_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (organization_id, plan, trial_ends_at)
  values (new.id, 'free', now() + interval '14 days')
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

create trigger organizations_start_trial
  after insert on public.organizations
  for each row execute function private.start_trial();

-- Entreprises existantes : essai de 14 jours à partir de la mise en service des offres
insert into public.subscriptions (organization_id, plan, trial_ends_at)
select id, 'free', now() + interval '14 days' from public.organizations
on conflict (organization_id) do nothing;

-- -----------------------------------------------------------------------------
-- Limites des offres. À garder identiques à PLANS dans src/lib/billing/plans.ts
-- (un test unitaire compare les deux). null = illimité.
-- -----------------------------------------------------------------------------
create or replace function private.plan_limits(p_plan text)
returns table (label text, max_bank_accounts integer, max_members integer, max_monthly_payments integer, approvals boolean)
language sql
immutable
set search_path = ''
as $$
  select v.label, v.max_bank_accounts, v.max_members, v.max_monthly_payments, v.approvals
  from (values
    ('free', 'Gratuit', 1, 1, 10, false),
    ('pro', 'Pro', 2, 3, null, false),
    ('business', 'Business', null, null, null, true),
    ('cabinet', 'Cabinet', null, null, null, true)
  ) as v (plan, label, max_bank_accounts, max_members, max_monthly_payments, approvals)
  where v.plan = p_plan;
$$;

-- Offre en vigueur : Business pendant l'essai, sinon l'offre souscrite (Gratuit par défaut)
create or replace function private.effective_plan(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case when s.trial_ends_at > now() then 'business' else s.plan end
     from public.subscriptions s where s.organization_id = p_organization_id),
    'free'
  );
$$;

-- Comptes bancaires actifs
create or replace function private.enforce_bank_account_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits record;
  active_count integer;
begin
  if not new.is_active or (tg_op = 'UPDATE' and old.is_active) then
    return new;
  end if;
  select * into limits from private.plan_limits(private.effective_plan(new.organization_id));
  if limits.max_bank_accounts is null then
    return new;
  end if;
  perform 1 from public.subscriptions where organization_id = new.organization_id for update;
  select count(*) into active_count from public.bank_accounts
  where organization_id = new.organization_id and is_active and id <> new.id;
  if active_count >= limits.max_bank_accounts then
    raise exception 'Votre offre % permet % compte(s) bancaire(s) actif(s). Archivez un compte ou passez à une offre supérieure.',
      limits.label, limits.max_bank_accounts using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger bank_accounts_plan_limit
  before insert or update of is_active on public.bank_accounts
  for each row execute function private.enforce_bank_account_limit();

-- Utilisateurs : membres + invitations en attente
create or replace function private.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits record;
  seats integer;
begin
  select * into limits from private.plan_limits(private.effective_plan(new.organization_id));
  if limits.max_members is null then
    return new;
  end if;
  perform 1 from public.subscriptions where organization_id = new.organization_id for update;
  select count(*) into seats from public.memberships where organization_id = new.organization_id;
  if tg_table_name = 'invitations' then
    seats := seats + (select count(*) from public.invitations
      where organization_id = new.organization_id and accepted_at is null and expires_at > now());
  end if;
  if seats >= limits.max_members then
    raise exception 'Votre offre % permet % utilisateur(s). Passez à une offre supérieure pour ajouter un membre.',
      limits.label, limits.max_members using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger invitations_plan_limit
  before insert on public.invitations
  for each row execute function private.enforce_member_limit();

create trigger memberships_plan_limit
  before insert on public.memberships
  for each row execute function private.enforce_member_limit();

-- Paiements créés dans le mois (UTC, comme le quota d'IA), quel que soit leur statut
create or replace function private.enforce_payment_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits record;
  month_count integer;
begin
  select * into limits from private.plan_limits(private.effective_plan(new.organization_id));
  if limits.max_monthly_payments is null then
    return new;
  end if;
  perform 1 from public.subscriptions where organization_id = new.organization_id for update;
  select count(*) into month_count from public.payments
  where organization_id = new.organization_id
    and created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  if month_count >= limits.max_monthly_payments then
    raise exception 'Votre offre % permet % paiements par mois. Passez à l''offre Pro pour des paiements illimités.',
      limits.label, limits.max_monthly_payments using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger payments_plan_limit
  before insert on public.payments
  for each row execute function private.enforce_payment_limit();

-- Double signature et plafonds : sans effet hors des offres Business et Cabinet
alter function private.approval_reasons(uuid, uuid, date, numeric[]) rename to approval_reasons_all;

create or replace function private.approval_reasons(
  p_organization_id uuid,
  p_supplier_id uuid,
  p_issue_date date,
  p_amounts numeric[]
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when (select l.approvals from private.plan_limits(private.effective_plan(p_organization_id)) l)
      then private.approval_reasons_all(p_organization_id, p_supplier_id, p_issue_date, p_amounts)
    else '[]'::jsonb
  end;
$$;

revoke execute on function private.effective_plan(uuid) from public;
revoke execute on function private.plan_limits(text) from public;
grant execute on function private.effective_plan(uuid) to authenticated, service_role;
grant execute on function private.plan_limits(text) to authenticated, service_role;
