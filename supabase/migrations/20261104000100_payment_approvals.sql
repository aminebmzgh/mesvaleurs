-- =============================================================================
-- Double signature et plafonds (spec §6.2 et §11 bis I). Un lot est soumis à
-- validation quand une formule dépasse le seuil de l'entreprise, ou quand le total
-- du jour dépasse un plafond (par utilisateur, par fournisseur, de l'entreprise).
-- Les numéros sont réservés dès la préparation ; les paiements restent en
-- brouillon (ils ne règlent aucune facture) et le lot ne s'imprime pas avant
-- validation par un gestionnaire ou un administrateur autre que le préparateur.
-- Un refus annule les paiements (formules réservées à détruire).
-- =============================================================================

create type public.batch_approval_status as enum ('not_required', 'pending', 'approved', 'refused');

alter table public.print_batches
  add column approval_status public.batch_approval_status not null default 'not_required',
  -- Motifs : [{ "kind": "threshold" | "user_daily" | "supplier_daily" | "org_daily", "limit": 50000, "total": 62000 }]
  add column approval_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(approval_reasons) = 'array'),
  add column decided_by uuid references auth.users (id) on delete set null,
  add column decided_at timestamptz,
  add column refusal_reason text check (length(refusal_reason) <= 300),
  add constraint print_batches_refusal_reason check (approval_status <> 'refused' or refusal_reason is not null);

create index print_batches_pending_idx on public.print_batches (organization_id, created_at)
  where approval_status = 'pending';

-- Plafonds journaliers (total des paiements datés du jour) : par utilisateur et par fournisseur
alter table public.memberships
  add column daily_ceiling numeric(14, 2) check (daily_ceiling > 0);
alter table public.suppliers
  add column daily_ceiling numeric(14, 2) check (daily_ceiling > 0);

-- -----------------------------------------------------------------------------
-- Écritures réservées aux fonctions : les paiements et les lots ne se créent,
-- ne se valident et ne se suppriment que par issue_payments, record_transfer,
-- approve_batch et refuse_batch (security definer).
-- -----------------------------------------------------------------------------
drop policy "payments_insert" on public.payments;
drop policy "payments_delete_drafts" on public.payments;
drop policy "print_batches_insert" on public.print_batches;
drop policy "print_batches_update" on public.print_batches;
drop policy "print_batches_delete" on public.print_batches;

-- Un paiement d'un lot à valider est figé dès la préparation (numéro réservé) et ne sort
-- du brouillon que par approve_batch (ou par annulation)
create or replace function private.payment_approval_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'draft' and old.print_batch_id is not null and (
    new.amount, new.number, new.checkbook_id, new.bank_account_id, new.supplier_id, new.payee_name, new.type, new.due_date, new.print_batch_id
  ) is distinct from (
    old.amount, old.number, old.checkbook_id, old.bank_account_id, old.supplier_id, old.payee_name, old.type, old.due_date, old.print_batch_id
  ) then
    raise exception 'Un paiement préparé ne peut plus être modifié : refusez le lot et préparez-en un nouveau.' using errcode = 'P0001';
  end if;
  if old.status = 'draft' and new.status not in ('draft', 'cancelled')
    and coalesce(current_setting('mesvaleurs.approving', true), '') <> 'on'
    and exists (
      select 1 from public.print_batches b
      where b.id = old.print_batch_id and b.approval_status in ('pending', 'refused')
    ) then
    raise exception 'Ce paiement attend la validation de son lot.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger payments_approval_guard
  before update on public.payments
  for each row execute function private.payment_approval_guard();

-- Le plafond d'un fournisseur ne se règle que par un gestionnaire ou un administrateur
create or replace function private.supplier_ceiling_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.daily_ceiling is not null)
    or (tg_op = 'UPDATE' and new.daily_ceiling is distinct from old.daily_ceiling) then
    if not private.has_role(new.organization_id, array['admin', 'manager']::public.app_role[]) then
      raise exception 'Seuls un administrateur ou un gestionnaire fixent le plafond d''un fournisseur.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger suppliers_ceiling_guard
  before insert or update of daily_ceiling on public.suppliers
  for each row execute function private.supplier_ceiling_guard();

-- -----------------------------------------------------------------------------
-- Motifs de validation d'un lot : seuil par formule, plafonds journaliers.
-- -----------------------------------------------------------------------------
create or replace function private.approval_reasons(
  p_organization_id uuid,
  p_supplier_id uuid,
  p_issue_date date,
  p_amounts numeric[]
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  org_settings jsonb;
  threshold numeric;
  batch_total numeric := (select coalesce(sum(a), 0) from unnest(p_amounts) a);
  cap numeric;
  day_total numeric;
  reasons jsonb := '[]'::jsonb;
begin
  select o.settings into org_settings from public.organizations o where o.id = p_organization_id;

  threshold := (org_settings ->> 'approval_threshold')::numeric;
  if threshold is not null and (select max(a) from unnest(p_amounts) a) > threshold then
    reasons := reasons || jsonb_build_object('kind', 'threshold', 'limit', threshold, 'total', (select max(a) from unnest(p_amounts) a));
  end if;

  -- Paiements datés du même jour, hors annulés (lots à valider compris)
  select m.daily_ceiling into cap from public.memberships m
  where m.organization_id = p_organization_id and m.user_id = auth.uid();
  if cap is not null then
    select coalesce(sum(p.amount), 0) + batch_total into day_total from public.payments p
    where p.organization_id = p_organization_id and p.created_by = auth.uid()
      and p.issue_date = p_issue_date and p.status <> 'cancelled';
    if day_total > cap then
      reasons := reasons || jsonb_build_object('kind', 'user_daily', 'limit', cap, 'total', day_total);
    end if;
  end if;

  select s.daily_ceiling into cap from public.suppliers s where s.id = p_supplier_id;
  if cap is not null then
    select coalesce(sum(p.amount), 0) + batch_total into day_total from public.payments p
    where p.organization_id = p_organization_id and p.supplier_id = p_supplier_id
      and p.issue_date = p_issue_date and p.status <> 'cancelled';
    if day_total > cap then
      reasons := reasons || jsonb_build_object('kind', 'supplier_daily', 'limit', cap, 'total', day_total);
    end if;
  end if;

  cap := (org_settings ->> 'daily_ceiling')::numeric;
  if cap is not null then
    select coalesce(sum(p.amount), 0) + batch_total into day_total from public.payments p
    where p.organization_id = p_organization_id and p.issue_date = p_issue_date and p.status <> 'cancelled';
    if day_total > cap then
      reasons := reasons || jsonb_build_object('kind', 'org_daily', 'limit', cap, 'total', day_total);
    end if;
  end if;

  return reasons;
end;
$$;

-- -----------------------------------------------------------------------------
-- Validation et refus d'un lot (gestionnaire ou administrateur, autre que le préparateur).
-- -----------------------------------------------------------------------------
create or replace function public.approve_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch public.print_batches;
begin
  select * into batch from public.print_batches where id = p_batch_id for update;
  if not found or not private.has_role(batch.organization_id, array['admin', 'manager']::public.app_role[]) then
    raise exception 'Lot introuvable ou validation réservée aux gestionnaires et administrateurs.' using errcode = 'P0002';
  end if;
  if batch.approval_status <> 'pending' then
    raise exception 'Ce lot n''est pas en attente de validation.' using errcode = 'P0001';
  end if;
  if batch.created_by = auth.uid() then
    raise exception 'Le lot doit être validé par une autre personne que celle qui l''a préparé.' using errcode = 'P0001';
  end if;

  perform set_config('mesvaleurs.approving', 'on', true);
  update public.payments set status = 'issued' where print_batch_id = p_batch_id and status = 'draft';
  perform set_config('mesvaleurs.approving', 'off', true);

  update public.print_batches
  set approval_status = 'approved', decided_by = auth.uid(), decided_at = now()
  where id = p_batch_id;

  perform public.log_audit_event(batch.organization_id, 'approve', 'print_batches', p_batch_id,
    jsonb_build_object('reasons', batch.approval_reasons));
end;
$$;

create or replace function public.refuse_batch(p_batch_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch public.print_batches;
  motive text := nullif(trim(p_reason), '');
begin
  select * into batch from public.print_batches where id = p_batch_id for update;
  if not found or not private.has_role(batch.organization_id, array['admin', 'manager']::public.app_role[]) then
    raise exception 'Lot introuvable ou validation réservée aux gestionnaires et administrateurs.' using errcode = 'P0002';
  end if;
  if batch.approval_status <> 'pending' then
    raise exception 'Ce lot n''est pas en attente de validation.' using errcode = 'P0001';
  end if;
  if batch.created_by = auth.uid() then
    raise exception 'Le lot doit être examiné par une autre personne que celle qui l''a préparé.' using errcode = 'P0001';
  end if;
  if motive is null or length(motive) < 3 or length(motive) > 300 then
    raise exception 'Indiquez le motif du refus.' using errcode = '22023';
  end if;

  -- Les numéros réservés restent dans l'historique, annulés avec le motif
  update public.payments
  set status = 'cancelled', cancellation_reason = 'Refusé à la validation : ' || motive
  where print_batch_id = p_batch_id and status = 'draft';

  update public.print_batches
  set approval_status = 'refused', decided_by = auth.uid(), decided_at = now(), refusal_reason = motive
  where id = p_batch_id;

  perform public.log_audit_event(batch.organization_id, 'refuse', 'print_batches', p_batch_id,
    jsonb_build_object('reason', motive));
end;
$$;

revoke execute on function public.approve_batch(uuid) from anon, public;
grant execute on function public.approve_batch(uuid) to authenticated;
revoke execute on function public.refuse_batch(uuid, text) from anon, public;
grant execute on function public.refuse_batch(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Impression : jamais avant validation.
-- -----------------------------------------------------------------------------
create or replace function public.record_batch_print(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch public.print_batches;
begin
  select * into batch from public.print_batches where id = p_batch_id for update;
  if not found or not private.has_role(batch.organization_id, array['admin', 'manager', 'preparer']::public.app_role[]) then
    raise exception 'Lot introuvable.' using errcode = 'P0002';
  end if;
  if batch.approval_status in ('pending', 'refused') then
    raise exception 'Ce lot n''a pas été validé : il ne peut pas être imprimé.' using errcode = 'P0001';
  end if;

  update public.print_batches
  set print_count = print_count + 1,
      printed_at = coalesce(printed_at, now())
  where id = p_batch_id;

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, details)
  values (
    batch.organization_id, auth.uid(),
    case when batch.print_count = 0 then 'print' else 'reprint' end,
    'print_batches', p_batch_id,
    jsonb_build_object('print_number', batch.print_count + 1)
  );
  return batch.print_count + 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- Émission : évaluation des motifs de validation ; lot « à valider » en brouillon.
-- -----------------------------------------------------------------------------

create or replace function public.issue_payments(
  p_organization_id uuid,
  p_checkbook_id uuid,
  p_supplier_id uuid,
  p_payee_name text,
  p_issue_date date,
  p_issue_place text,
  -- [{ "amount": 1234.56, "due_date": "2026-11-25" }]
  p_instruments jsonb,
  -- [{ "index": 0, "invoice_id": "…", "amount": 1234.56 }]
  p_allocations jsonb default '[]'::jsonb,
  -- Chèque de garantie : { "purpose": "…", "return_due": "2027-03-31" } (sans affectation)
  p_guarantee jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  book public.checkbooks;
  account_active boolean;
  instrument_count integer;
  instrument jsonb;
  allocation jsonb;
  payment_type public.payment_type;
  batch_id uuid;
  payment_ids uuid[] := '{}'::uuid[];
  numbers bigint[];
  new_next bigint;
  new_payment_id uuid;
  payee text := nullif(trim(p_payee_name), '');
  idx integer;
  amount numeric(14, 2);
  due date;
  allocated numeric(14, 2);
  amounts numeric[];
  reasons jsonb;
  pending boolean;
begin
  -- Droits : seuls les rôles qui saisissent des paiements
  if not private.has_role(p_organization_id, array['admin', 'manager', 'preparer']::public.app_role[]) then
    raise exception 'Votre rôle ne permet pas d''émettre des paiements.' using errcode = '42501';
  end if;

  -- Carnet : verrouillé jusqu'à la fin de la transaction (aucun numéro en double)
  select * into book
  from public.checkbooks
  where id = p_checkbook_id and organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Carnet introuvable.' using errcode = 'P0002';
  end if;
  if book.status <> 'active' then
    raise exception 'Ce carnet n''est plus en service.' using errcode = 'P0001';
  end if;
  select is_active into account_active from public.bank_accounts where id = book.bank_account_id;
  if not account_active then
    raise exception 'Le compte bancaire de ce carnet est archivé.' using errcode = 'P0001';
  end if;
  payment_type := book.type::text::public.payment_type;

  -- Chèque de garantie : remis sans intention d'encaissement, il ne règle aucune facture
  if p_guarantee is not null then
    if book.type <> 'check' then
      raise exception 'Un chèque de garantie s''émet depuis un chéquier.' using errcode = 'P0001';
    end if;
    if nullif(p_guarantee ->> 'return_due', '') is null or (p_guarantee ->> 'return_due')::date < p_issue_date then
      raise exception 'La date de restitution prévue doit suivre la date d''émission.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_allocations) > 0 then
      raise exception 'Un chèque de garantie ne règle aucune facture.' using errcode = '22023';
    end if;
    payment_type := 'guarantee_check';
  end if;

  -- Fournisseur
  if not exists (
    select 1 from public.suppliers
    where id = p_supplier_id and organization_id = p_organization_id and is_active
  ) then
    raise exception 'Fournisseur introuvable ou archivé.' using errcode = 'P0002';
  end if;
  if payee is null then
    select coalesce(nullif(trim(payee_name), ''), name) into payee from public.suppliers where id = p_supplier_id;
  end if;

  -- Formules
  if jsonb_typeof(p_instruments) <> 'array' then
    raise exception 'Liste des formules invalide.' using errcode = '22023';
  end if;
  instrument_count := jsonb_array_length(p_instruments);
  if instrument_count < 1 or instrument_count > 24 then
    raise exception 'Le nombre de formules doit être compris entre 1 et 24.' using errcode = '22023';
  end if;
  numbers := private.available_numbers(book.id, book.next_number, book.last_number, instrument_count);
  if coalesce(array_length(numbers, 1), 0) < instrument_count then
    raise exception 'Formules insuffisantes : il reste % formule(s) dans ce carnet.',
      coalesce(array_length(numbers, 1), 0) using errcode = 'P0001';
  end if;

  -- Double signature : seuil par formule et plafonds journaliers
  select array_agg((value ->> 'amount')::numeric) into amounts from jsonb_array_elements(p_instruments);
  reasons := private.approval_reasons(p_organization_id, p_supplier_id, p_issue_date, amounts);
  pending := jsonb_array_length(reasons) > 0;

  insert into public.print_batches (organization_id, created_by, approval_status, approval_reasons)
  values (
    p_organization_id, auth.uid(),
    case when pending then 'pending' else 'not_required' end::public.batch_approval_status, reasons
  )
  returning id into batch_id;

  for slot in 0 .. instrument_count - 1 loop
    instrument := p_instruments -> slot;
    amount := (instrument ->> 'amount')::numeric(14, 2);
    due := nullif(instrument ->> 'due_date', '')::date;
    if amount is null or amount <= 0 then
      raise exception 'Formule % : montant invalide.', slot + 1 using errcode = '22023';
    end if;
    if payment_type = 'lcn' and (due is null or due < p_issue_date) then
      raise exception 'LCN % : la date d''échéance doit être postérieure ou égale à la date d''émission.', slot + 1
        using errcode = '22023';
    end if;

    insert into public.payments (
      organization_id, type, status, bank_account_id, checkbook_id, number, supplier_id, payee_name,
      amount, issue_date, issue_place, due_date, print_batch_id, created_by,
      guarantee_purpose, guarantee_return_due
    ) values (
      -- Lot à valider : numéros réservés, paiements en brouillon jusqu'à la validation
      p_organization_id, payment_type, case when pending then 'draft' else 'issued' end::public.payment_status, book.bank_account_id, book.id, numbers[slot + 1],
      p_supplier_id, payee, amount, p_issue_date, nullif(trim(p_issue_place), ''),
      case when payment_type = 'lcn' then due end, batch_id, auth.uid(),
      nullif(trim(p_guarantee ->> 'purpose'), ''), (p_guarantee ->> 'return_due')::date
    )
    returning id into new_payment_id;
    payment_ids := payment_ids || new_payment_id;
  end loop;

  -- Affectations aux factures : factures du même fournisseur, non contestées
  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Affectations invalides.' using errcode = '22023';
  end if;
  for allocation in select value from jsonb_array_elements(p_allocations) loop
    idx := (allocation ->> 'index')::integer;
    if idx is null or idx < 0 or idx >= instrument_count then
      raise exception 'Affectation rattachée à une formule inexistante.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.invoices
      where id = (allocation ->> 'invoice_id')::uuid
        and organization_id = p_organization_id
        and supplier_id = p_supplier_id
        and status <> 'disputed'
    ) then
      raise exception 'Facture introuvable, d''un autre fournisseur ou contestée.' using errcode = 'P0002';
    end if;
    insert into public.payment_allocations (organization_id, payment_id, invoice_id, amount)
    values (
      p_organization_id, payment_ids[idx + 1], (allocation ->> 'invoice_id')::uuid,
      (allocation ->> 'amount')::numeric(14, 2)
    );
  end loop;

  -- Chaque formule affectée doit l'être pour son montant exact
  if jsonb_array_length(p_allocations) > 0 then
    for slot in 1 .. instrument_count loop
      select coalesce(sum(a.amount), 0) into allocated from public.payment_allocations a where a.payment_id = payment_ids[slot];
      if allocated <> (select p.amount from public.payments p where p.id = payment_ids[slot]) then
        raise exception 'Formule % : le montant affecté aux factures ne correspond pas au montant de la formule.', slot
          using errcode = '22023';
      end if;
    end loop;
  end if;

  -- Avancement du carnet, au-delà des formules en opposition qui suivent
  new_next := private.next_available_number(book.id, numbers[instrument_count] + 1, book.last_number);
  update public.checkbooks
  set next_number = new_next,
      status = case when new_next > book.last_number then 'exhausted' else status end
  where id = book.id;

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, details)
  values (
    p_organization_id, auth.uid(), 'issue', 'print_batches', batch_id,
    jsonb_build_object(
      'checkbook_id', book.id,
      'first_number', numbers[1],
      'last_number', numbers[instrument_count],
      'payment_ids', to_jsonb(payment_ids),
      'approval_reasons', reasons
    )
  );

  return batch_id;
end;
$$;
