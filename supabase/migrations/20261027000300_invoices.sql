-- =============================================================================
-- Factures : paramètres légaux, date limite de paiement, montants « réglé » et
-- « encaissé » et statut maintenus par la base.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Paramètres légaux (loi 69-21), configurables et jamais codés dans l'application.
-- Lecture par tout utilisateur connecté ; modification réservée à l'administration
-- de la plateforme (service_role). Complétés en Phase 3 (pénalités, seuils).
-- -----------------------------------------------------------------------------

create table public.legal_settings (
  key text primary key,
  value numeric not null,
  description text not null,
  updated_at timestamptz not null default now()
);

alter table public.legal_settings enable row level security;

create policy "legal_settings_select" on public.legal_settings
  for select to authenticated
  using (true);

insert into public.legal_settings (key, value, description) values
  ('payment_terms_default_days', 60,
   'Délai de paiement applicable sans délai convenu, en jours à compter de la date de facture (loi 69-21, à valider par un expert-comptable).'),
  ('payment_terms_max_days', 120,
   'Plafond légal du délai convenu, en jours (loi 69-21, à valider par un expert-comptable).');

create or replace function private.legal_setting(setting_key text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.legal_settings where key = setting_key;
$$;

-- -----------------------------------------------------------------------------
-- Date limite légale : date de facture + délai convenu (facture, sinon fournisseur),
-- à défaut le délai légal par défaut, toujours plafonné au maximum légal.
-- -----------------------------------------------------------------------------

create or replace function private.invoice_legal_due_date()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  agreed_days integer;
  applied_days integer;
begin
  agreed_days := coalesce(
    new.payment_terms_days,
    (select payment_terms_days from public.suppliers where id = new.supplier_id)
  );
  applied_days := least(
    coalesce(agreed_days, private.legal_setting('payment_terms_default_days')::integer),
    private.legal_setting('payment_terms_max_days')::integer
  );
  new.legal_due_date := new.issue_date + applied_days;
  return new;
end;
$$;

create trigger invoices_legal_due_date
  before insert or update of issue_date, payment_terms_days, supplier_id on public.invoices
  for each row execute function private.invoice_legal_due_date();

-- Un changement du délai convenu du fournisseur se répercute sur ses factures qui
-- n'ont pas de délai propre
create or replace function private.supplier_terms_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invoices
  set issue_date = issue_date -- déclenche le recalcul de legal_due_date
  where supplier_id = new.id
    and payment_terms_days is null;
  return new;
end;
$$;

create trigger suppliers_terms_changed
  after update of payment_terms_days on public.suppliers
  for each row
  when (old.payment_terms_days is distinct from new.payment_terms_days)
  execute function private.supplier_terms_changed();


-- -----------------------------------------------------------------------------
-- Statut : toujours déduit des montants, sauf « contestée » (choix manuel).
-- -----------------------------------------------------------------------------

create or replace function private.invoice_derive_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'disputed' then
    new.status := case
      when new.amount_paid >= new.amount_incl_tax then 'paid'
      when new.amount_paid > 0 then 'partially_paid'
      else 'unpaid'
    end::public.invoice_status;
  end if;
  return new;
end;
$$;

create trigger invoices_derive_status
  before insert or update on public.invoices
  for each row execute function private.invoice_derive_status();

-- -----------------------------------------------------------------------------
-- Montants « réglé » et « encaissé », recalculés à chaque changement d'affectation
-- ou de statut de paiement.
--   réglé    : affectations des paiements émis, remis ou débités ;
--   encaissé : affectations des paiements débités.
-- Brouillons, annulés, rejetés, perdus, en opposition et chèques de garantie exclus.
-- -----------------------------------------------------------------------------

create or replace function private.refresh_invoice_totals(target_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid numeric(14, 2);
  cashed numeric(14, 2);
begin
  select
    coalesce(sum(a.amount) filter (where p.status in ('issued', 'delivered', 'paid')), 0),
    coalesce(sum(a.amount) filter (where p.status = 'paid'), 0)
  into paid, cashed
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  where a.invoice_id = target_invoice_id
    and p.type <> 'guarantee_check';

  -- Le statut est recalculé par invoices_derive_status
  update public.invoices
  set amount_paid = paid,
      amount_cashed = cashed
  where id = target_invoice_id
    and (amount_paid, amount_cashed) is distinct from (paid, cashed);
end;
$$;

create or replace function private.allocation_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_invoice_totals(old.invoice_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.invoice_id is distinct from old.invoice_id
       or new.amount is distinct from old.amount) then
    perform private.refresh_invoice_totals(new.invoice_id);
  end if;
  return null;
end;
$$;

create trigger payment_allocations_refresh_invoice
  after insert or update or delete on public.payment_allocations
  for each row execute function private.allocation_changed();

create or replace function private.payment_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocation record;
begin
  for allocation in select invoice_id from public.payment_allocations where payment_id = new.id loop
    perform private.refresh_invoice_totals(allocation.invoice_id);
  end loop;
  return null;
end;
$$;

create trigger payments_refresh_invoices
  after update of status, type on public.payments
  for each row
  when (old.status is distinct from new.status or old.type is distinct from new.type)
  execute function private.payment_changed();

-- -----------------------------------------------------------------------------
-- Garde-fous
-- -----------------------------------------------------------------------------

-- Une facture rattachée à des paiements ne change pas de fournisseur
create or replace function private.invoice_protect_supplier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.payment_allocations where invoice_id = old.id) then
    raise exception 'Cette facture est rattachée à des paiements : son fournisseur ne peut plus être modifié.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger invoices_protect_supplier
  before update of supplier_id on public.invoices
  for each row
  when (old.supplier_id is distinct from new.supplier_id)
  execute function private.invoice_protect_supplier();

-- Montants réglé / encaissé et date limite légale : écrits uniquement par la base.
-- Un droit accordé sur toute la table l'emporte sur un retrait par colonne : on
-- retire donc le droit sur la table, puis on accorde les seules colonnes saisies.
revoke insert, update on public.invoices from authenticated, anon;
grant insert (
  id, organization_id, supplier_id, number, issue_date, delivery_date, amount_excl_tax, vat_amount,
  amount_incl_tax, payment_terms_days, status, attachment_path, notes
) on public.invoices to authenticated;
grant update (
  supplier_id, number, issue_date, delivery_date, amount_excl_tax, vat_amount, amount_incl_tax,
  payment_terms_days, status, attachment_path, notes
) on public.invoices to authenticated;

-- Le préparateur, qui saisit les factures, peut remplacer leur pièce jointe :
-- il doit donc pouvoir supprimer l'ancien fichier du bucket `factures`.
create policy "org_invoice_files_delete_preparer" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'factures'
    and private.storage_object_org_id(name) in (select private.role_org_ids('{preparer}'))
  );
