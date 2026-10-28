-- =============================================================================
-- Chèques de garantie (spec §11 bis C) : remis à un fournisseur sans intention
-- d'encaissement immédiat. Ils ne règlent aucune facture et sont exclus des
-- prévisions ; restitution prévue, rappel, puis restitué, détruit ou encaissé.
-- =============================================================================

create type public.guarantee_outcome as enum ('returned', 'destroyed');

alter table public.payments
  add column guarantee_purpose text check (length(guarantee_purpose) <= 200),
  add column guarantee_return_due date,
  add column guarantee_outcome public.guarantee_outcome,
  add column guarantee_closed_at date,
  add constraint payments_guarantee_details
    check (type <> 'guarantee_check' or guarantee_return_due is not null),
  add constraint payments_guarantee_outcome
    check (guarantee_outcome is null or (type = 'guarantee_check' and status = 'cancelled'));

create index payments_org_guarantee_idx on public.payments (organization_id, guarantee_return_due)
  where type = 'guarantee_check' and status in ('issued', 'delivered');

-- Émission : paramètre « chèque de garantie » ajouté (nouvelle signature)
drop function public.issue_payments(uuid, uuid, uuid, text, date, text, jsonb, jsonb);

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
  new_payment_id uuid;
  payee text := nullif(trim(p_payee_name), '');
  idx integer;
  amount numeric(14, 2);
  due date;
  allocated numeric(14, 2);
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
  if book.last_number - book.next_number + 1 < instrument_count then
    raise exception 'Formules insuffisantes : il reste % formule(s) dans ce carnet.',
      greatest(book.last_number - book.next_number + 1, 0) using errcode = 'P0001';
  end if;

  insert into public.print_batches (organization_id, created_by)
  values (p_organization_id, auth.uid())
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
      p_organization_id, payment_type, 'issued', book.bank_account_id, book.id, book.next_number + slot,
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

  -- Avancement du carnet
  update public.checkbooks
  set next_number = book.next_number + instrument_count,
      status = case when book.next_number + instrument_count > book.last_number then 'exhausted' else status end
  where id = book.id;

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, details)
  values (
    p_organization_id, auth.uid(), 'issue', 'print_batches', batch_id,
    jsonb_build_object(
      'checkbook_id', book.id,
      'first_number', book.next_number,
      'last_number', book.next_number + instrument_count - 1,
      'payment_ids', to_jsonb(payment_ids)
    )
  );

  return batch_id;
end;
$$;

revoke execute on function public.issue_payments(uuid, uuid, uuid, text, date, text, jsonb, jsonb, jsonb) from anon, public;
grant execute on function public.issue_payments(uuid, uuid, uuid, text, date, text, jsonb, jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Clôture d'un chèque de garantie : restitué par le fournisseur ou détruit.
-- (Encaissé : débit constaté par le rapprochement ou saisi depuis la liste.)
-- -----------------------------------------------------------------------------
create or replace function public.close_guarantee(
  p_payment_id uuid,
  p_outcome public.guarantee_outcome,
  p_closed_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payments;
begin
  select * into payment from public.payments where id = p_payment_id for update;
  if not found or not private.has_role(payment.organization_id, array['admin', 'manager', 'preparer']::public.app_role[]) then
    raise exception 'Paiement introuvable.' using errcode = 'P0002';
  end if;
  if payment.type <> 'guarantee_check' or payment.status not in ('issued', 'delivered') then
    raise exception 'Ce chèque de garantie n''est plus chez le fournisseur.' using errcode = 'P0001';
  end if;
  if p_outcome is null or p_closed_on is null or p_closed_on > current_date or p_closed_on < payment.issue_date then
    raise exception 'Issue ou date invalide.' using errcode = '22023';
  end if;

  update public.payments
  set status = 'cancelled',
      cancellation_reason = case p_outcome when 'returned' then 'Chèque de garantie restitué' else 'Chèque de garantie détruit' end,
      guarantee_outcome = p_outcome,
      guarantee_closed_at = p_closed_on
  where id = p_payment_id;
end;
$$;

revoke execute on function public.close_guarantee(uuid, public.guarantee_outcome, date) from anon, public;
grant execute on function public.close_guarantee(uuid, public.guarantee_outcome, date) to authenticated;
