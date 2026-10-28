-- =============================================================================
-- Virements fournisseurs : paiement sans formule ni numéro, identifié par sa
-- référence. Saisi déjà débité, ou en attente puis rapproché avec le relevé.
-- =============================================================================

alter table public.payments
  add column reference text check (length(trim(reference)) between 1 and 100);

-- Numéro obligatoire hors brouillon, sauf pour un virement
alter table public.payments drop constraint payments_check;
alter table public.payments add constraint payments_number_required
  check (status = 'draft' or type = 'transfer' or number is not null);

-- Un virement n'a ni carnet, ni numéro, ni lot d'impression
alter table public.payments add constraint payments_transfer_shape
  check (type <> 'transfer' or (checkbook_id is null and number is null and print_batch_id is null));

-- -----------------------------------------------------------------------------
-- Saisie d'un virement, en une transaction : paiement, affectations aux factures.
-- security definer, comme issue_payments : le rôle et l'appartenance de chaque
-- identifiant à l'organisation sont vérifiés ici.
-- -----------------------------------------------------------------------------
create or replace function public.record_transfer(
  p_organization_id uuid,
  p_bank_account_id uuid,
  p_supplier_id uuid,
  p_amount numeric,
  p_transfer_date date,
  p_reference text,
  -- true : déjà débité (date de débit = date du virement) ; false : en attente du relevé
  p_debited boolean,
  -- [{ "invoice_id": "…", "amount": 1234.56 }]
  p_allocations jsonb default '[]'::jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payee text;
  new_payment_id uuid;
  allocation jsonb;
  allocated numeric(14, 2) := 0;
begin
  if not private.has_role(p_organization_id, array['admin', 'manager', 'preparer']::public.app_role[]) then
    raise exception 'Votre rôle ne permet pas de saisir des paiements.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.bank_accounts
    where id = p_bank_account_id and organization_id = p_organization_id and is_active
  ) then
    raise exception 'Compte bancaire introuvable ou archivé.' using errcode = 'P0002';
  end if;
  select coalesce(nullif(trim(payee_name), ''), name) into payee
  from public.suppliers
  where id = p_supplier_id and organization_id = p_organization_id and is_active;
  if not found then
    raise exception 'Fournisseur introuvable ou archivé.' using errcode = 'P0002';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant du virement doit être positif.' using errcode = '22023';
  end if;
  if p_transfer_date is null or p_transfer_date > current_date + 365 then
    raise exception 'Date du virement invalide.' using errcode = '22023';
  end if;
  if nullif(trim(p_reference), '') is null then
    raise exception 'La référence du virement est obligatoire.' using errcode = '22023';
  end if;

  insert into public.payments (
    organization_id, type, status, bank_account_id, supplier_id, payee_name, amount,
    issue_date, debited_at, reference, notes, created_by
  ) values (
    p_organization_id, 'transfer', case when p_debited then 'paid' else 'issued' end::public.payment_status,
    p_bank_account_id, p_supplier_id, payee, p_amount::numeric(14, 2),
    p_transfer_date, case when p_debited then p_transfer_date end, trim(p_reference), nullif(trim(p_notes), ''), auth.uid()
  )
  returning id into new_payment_id;

  -- Affectations : factures du même fournisseur, non contestées, pour le montant exact
  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Affectations invalides.' using errcode = '22023';
  end if;
  for allocation in select value from jsonb_array_elements(p_allocations) loop
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
    values (p_organization_id, new_payment_id, (allocation ->> 'invoice_id')::uuid, (allocation ->> 'amount')::numeric(14, 2));
    allocated := allocated + (allocation ->> 'amount')::numeric(14, 2);
  end loop;
  if jsonb_array_length(p_allocations) > 0 and allocated <> p_amount::numeric(14, 2) then
    raise exception 'Le montant affecté aux factures ne correspond pas au montant du virement.' using errcode = '22023';
  end if;

  return new_payment_id;
end;
$$;

revoke execute on function public.record_transfer(uuid, uuid, uuid, numeric, date, text, boolean, jsonb, text) from anon, public;
grant execute on function public.record_transfer(uuid, uuid, uuid, numeric, date, text, boolean, jsonb, text) to authenticated;
