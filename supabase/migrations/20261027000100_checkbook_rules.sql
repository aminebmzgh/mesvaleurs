-- =============================================================================
-- Règles des comptes bancaires et des chéquiers / carnets de LCN.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- Deux carnets du même type sur un même compte ne peuvent pas partager de numéros :
-- garantit, avec l'index unique (checkbook_id, number), qu'un numéro de chèque
-- ou de LCN n'est jamais attribué deux fois sur un compte.
alter table public.checkbooks
  add constraint checkbooks_no_overlapping_ranges
  exclude using gist (
    bank_account_id with =,
    type with =,
    int8range(first_number, last_number, '[]') with &&
  );

-- Valeurs initiales calculées par la base
create or replace function private.checkbook_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Un nouveau carnet commence à son premier numéro
  if new.next_number is null then
    new.next_number := new.first_number;
  end if;
  return new;
end;
$$;

create trigger checkbooks_defaults
  before insert on public.checkbooks
  for each row execute function private.checkbook_defaults();

-- La plage d'un carnet ne peut plus être modifiée une fois des numéros attribués
create or replace function private.checkbook_protect_range()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.first_number <> old.first_number or new.last_number <> old.last_number)
    and exists (select 1 from public.payments where checkbook_id = old.id and number is not null) then
    raise exception 'Des numéros de ce carnet ont déjà été utilisés : sa plage ne peut plus être modifiée.'
      using errcode = 'P0001';
  end if;
  if new.next_number < old.next_number then
    raise exception 'Le prochain numéro d''un carnet ne peut pas reculer.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger checkbooks_protect_range
  before update of first_number, last_number, next_number on public.checkbooks
  for each row execute function private.checkbook_protect_range();

-- Le solde courant d'un nouveau compte part du solde d'ouverture
create or replace function private.bank_account_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.current_balance := new.opening_balance;
  return new;
end;
$$;

create trigger bank_accounts_defaults
  before insert on public.bank_accounts
  for each row execute function private.bank_account_defaults();

-- Un même RIB n'est enregistré qu'une fois par organisation
create unique index bank_accounts_org_rib_idx
  on public.bank_accounts (organization_id, rib)
  where rib is not null;

-- Vue de synthèse des carnets : formules restantes et utilisation.
-- security_invoker : la RLS des tables sous-jacentes s'applique à l'utilisateur.
create view public.checkbook_summaries
with (security_invoker = true)
as
select
  c.id,
  c.organization_id,
  c.bank_account_id,
  c.type,
  c.first_number,
  c.last_number,
  c.next_number,
  c.number_width,
  c.status,
  c.received_at,
  c.created_at,
  (c.last_number - c.first_number + 1)::integer as total_count,
  greatest(c.last_number - c.next_number + 1, 0)::integer as remaining_count,
  (select count(*) from public.payments p where p.checkbook_id = c.id and p.status = 'cancelled')::integer
    as cancelled_count
from public.checkbooks c;

-- Corriger le solde d'ouverture décale le solde courant du même écart
create or replace function private.bank_account_opening_balance_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.current_balance := old.current_balance + (new.opening_balance - old.opening_balance);
  return new;
end;
$$;

create trigger bank_accounts_opening_balance_change
  before update of opening_balance on public.bank_accounts
  for each row
  when (old.opening_balance is distinct from new.opening_balance)
  execute function private.bank_account_opening_balance_change();
