-- =============================================================================
-- Émission d'un lot de chèques ou de LCN, en une seule transaction :
-- numéros attribués à la suite dans le carnet (verrouillé), paiements créés en
-- « émis », affectations aux factures, lot d'impression, journal d'audit.
--
-- security definer : un préparateur émet des paiements sans pouvoir modifier les
-- carnets (RLS) ; la fonction vérifie elle-même le rôle et l'appartenance de
-- chaque identifiant à l'organisation.
-- =============================================================================

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
  p_allocations jsonb default '[]'::jsonb
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
      amount, issue_date, issue_place, due_date, print_batch_id, created_by
    ) values (
      p_organization_id, payment_type, 'issued', book.bank_account_id, book.id, book.next_number + slot,
      p_supplier_id, payee, amount, p_issue_date, nullif(trim(p_issue_place), ''),
      case when payment_type = 'lcn' then due end, batch_id, auth.uid()
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

revoke execute on function public.issue_payments(uuid, uuid, uuid, text, date, text, jsonb, jsonb) from anon, public;
grant execute on function public.issue_payments(uuid, uuid, uuid, text, date, text, jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Cycle de vie d'un paiement
--   brouillon → émis, annulé
--   émis      → remis, débité, rejeté, annulé, perdu, en opposition
--   remis     → émis (remise annulée), débité, rejeté, annulé, perdu, en opposition
--   débité    → émis, remis (rapprochement défait), rejeté (impayé après débit)
--   rejeté    → émis, remis (remise en circulation), annulé
--   perdu, en opposition → annulé
--   annulé    : définitif (le numéro reste dans l'historique avec son motif)
-- Une fois émis, montant, numéro, carnet, compte, fournisseur, bénéficiaire et type
-- sont figés : ils sont imprimés sur la formule.
-- -----------------------------------------------------------------------------

create or replace function private.payment_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed text[];
begin
  if old.status <> 'draft' and (
    new.amount, new.number, new.checkbook_id, new.bank_account_id, new.supplier_id, new.payee_name, new.type
  ) is distinct from (
    old.amount, old.number, old.checkbook_id, old.bank_account_id, old.supplier_id, old.payee_name, old.type
  ) then
    raise exception 'Un paiement émis ne peut plus être modifié (montant, numéro, bénéficiaire…). Annulez-le et émettez-en un nouveau.'
      using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    allowed := case old.status
      when 'draft' then array['issued', 'cancelled']
      when 'issued' then array['delivered', 'paid', 'rejected', 'cancelled', 'lost', 'stopped']
      when 'delivered' then array['issued', 'paid', 'rejected', 'cancelled', 'lost', 'stopped']
      when 'paid' then array['issued', 'delivered', 'rejected']
      when 'rejected' then array['issued', 'delivered', 'cancelled']
      when 'lost' then array['cancelled']
      when 'stopped' then array['cancelled']
      else array[]::text[]
    end;
    if not (new.status::text = any (allowed)) then
      raise exception 'Changement de statut impossible : « % » vers « % ».', old.status, new.status
        using errcode = 'P0001';
    end if;
    -- Date de débit cohérente avec le statut
    if new.status <> 'paid' then
      new.debited_at := null;
    elsif new.debited_at is null then
      new.debited_at := current_date;
    end if;
  end if;
  return new;
end;
$$;

create trigger payments_guard
  before update on public.payments
  for each row execute function private.payment_guard();
