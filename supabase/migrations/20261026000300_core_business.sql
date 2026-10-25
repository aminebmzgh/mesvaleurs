-- =============================================================================
-- Tables métier : comptes bancaires, chéquiers / carnets de LCN, modèles
-- d'impression, fournisseurs, factures, paiements (chèques et LCN), affectations
-- paiement ↔ facture, imports de relevés et lignes de relevé.
--
-- Intégrité multi-tenant : les références entre tables métier utilisent des clés
-- étrangères composites (organization_id, id), ce qui rend impossible, au niveau
-- de la base, de rattacher une facture au fournisseur d'une autre organisation.
-- Les montants sont en dirhams, numeric(14, 2).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

create type public.instrument_type as enum ('check', 'lcn');

-- Chèque, LCN ou chèque de garantie (non comptabilisé dans le règlement des factures)
create type public.payment_type as enum ('check', 'lcn', 'guarantee_check');

-- brouillon, émis (imprimé), remis au fournisseur, payé (débité), rejeté,
-- annulé, perdu, en opposition
create type public.payment_status as enum (
  'draft',
  'issued',
  'delivered',
  'paid',
  'rejected',
  'cancelled',
  'lost',
  'stopped'
);

-- non payée, partiellement payée, payée, contestée
create type public.invoice_status as enum ('unpaid', 'partially_paid', 'paid', 'disputed');

create type public.checkbook_status as enum ('active', 'exhausted', 'archived');

create type public.statement_format as enum ('csv', 'excel', 'pdf_text', 'pdf_scan');

create type public.statement_import_status as enum ('pending', 'processing', 'review', 'completed', 'failed');

-- rapproché automatiquement, rapproché manuellement, à confirmer, non rapproché, ignoré
create type public.statement_line_status as enum (
  'auto_matched',
  'manually_matched',
  'to_confirm',
  'unmatched',
  'ignored'
);

-- -----------------------------------------------------------------------------
-- Comptes bancaires
-- -----------------------------------------------------------------------------

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bank_id uuid not null references public.banks (id),
  label text not null check (length(trim(label)) between 1 and 120),
  branch text, -- agence
  -- RIB marocain : 24 chiffres (la clé est validée côté application)
  rib text check (rib ~ '^\d{24}$'),
  currency text not null default 'MAD' check (currency ~ '^[A-Z]{3}$'),
  opening_balance numeric(14, 2) not null default 0,
  opening_balance_date date not null default current_date,
  current_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index bank_accounts_org_idx on public.bank_accounts (organization_id);

-- -----------------------------------------------------------------------------
-- Modèles d'impression (formules de chèques et de LCN)
-- -----------------------------------------------------------------------------

create table public.print_templates (
  id uuid primary key default gen_random_uuid(),
  -- null : modèle fourni par défaut pour une banque, en lecture seule
  organization_id uuid references public.organizations (id) on delete cascade,
  bank_id uuid references public.banks (id),
  type public.instrument_type not null,
  name text not null check (length(trim(name)) between 1 and 120),
  width_mm numeric(6, 2) not null check (width_mm > 0),
  height_mm numeric(6, 2) not null check (height_mm > 0),
  background_path text,
  -- Zones : [{ field, x_mm, y_mm, width_mm, font, font_size, align, lines }]
  zones jsonb not null default '[]'::jsonb check (jsonb_typeof(zones) = 'array'),
  -- Décalage imprimante global
  offset_x_mm numeric(6, 2) not null default 0,
  offset_y_mm numeric(6, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index print_templates_org_idx on public.print_templates (organization_id);

-- -----------------------------------------------------------------------------
-- Chéquiers et carnets de LCN
-- -----------------------------------------------------------------------------

create table public.checkbooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bank_account_id uuid not null,
  type public.instrument_type not null,
  first_number bigint not null check (first_number >= 0),
  last_number bigint not null,
  -- Prochain numéro disponible ; vaut last_number + 1 quand le carnet est épuisé
  next_number bigint not null,
  -- Nombre de chiffres affichés (zéros initiaux), ex. 7 pour 0001234
  number_width smallint not null default 7 check (number_width between 1 and 12),
  print_template_id uuid references public.print_templates (id) on delete set null,
  status public.checkbook_status not null default 'active',
  received_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, bank_account_id)
    references public.bank_accounts (organization_id, id) on delete cascade,
  check (last_number >= first_number),
  check (next_number between first_number and last_number + 1)
);

create index checkbooks_account_idx on public.checkbooks (bank_account_id);

-- -----------------------------------------------------------------------------
-- Fournisseurs
-- -----------------------------------------------------------------------------

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200), -- raison sociale
  -- Nom imprimé sur le chèque (bénéficiaire), par défaut la raison sociale
  payee_name text check (length(payee_name) <= 200),
  ice text check (ice ~ '^\d{15}$'),
  tax_id text,
  trade_register text,
  rib text check (rib ~ '^\d{24}$'),
  address text,
  city text,
  contact_name text,
  email text,
  phone text,
  -- Délai de paiement convenu, en jours
  payment_terms_days smallint check (payment_terms_days between 0 and 365),
  print_cover_letter boolean not null default true,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index suppliers_org_name_idx on public.suppliers (organization_id, lower(name));

-- -----------------------------------------------------------------------------
-- Factures fournisseurs
-- -----------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid not null,
  number text not null check (length(trim(number)) between 1 and 60),
  issue_date date not null,
  delivery_date date,
  amount_excl_tax numeric(14, 2) check (amount_excl_tax >= 0),
  vat_amount numeric(14, 2) check (vat_amount >= 0),
  amount_incl_tax numeric(14, 2) not null check (amount_incl_tax > 0),
  -- Somme des affectations de paiements (hors annulés), maintenue par la base
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),
  payment_terms_days smallint check (payment_terms_days between 0 and 365),
  -- Date limite légale de paiement (loi 69-21), calculée
  legal_due_date date,
  status public.invoice_status not null default 'unpaid',
  attachment_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- Une facture en double (même fournisseur + même numéro) est refusée
  unique (organization_id, supplier_id, number),
  foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id) on delete restrict
);

create index invoices_supplier_idx on public.invoices (supplier_id);
create index invoices_org_status_idx on public.invoices (organization_id, status);

-- -----------------------------------------------------------------------------
-- Lots d'impression
-- -----------------------------------------------------------------------------

create table public.print_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

-- -----------------------------------------------------------------------------
-- Paiements (chèques, LCN, chèques de garantie)
-- -----------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type public.payment_type not null,
  status public.payment_status not null default 'draft',
  bank_account_id uuid not null,
  checkbook_id uuid,
  -- Numéro de la formule, attribué à l'impression (null tant que brouillon)
  number bigint check (number >= 0),
  supplier_id uuid not null,
  payee_name text not null check (length(trim(payee_name)) between 1 and 200),
  amount numeric(14, 2) not null check (amount > 0),
  issue_date date not null default current_date,
  issue_place text,
  -- Date d'échéance (LCN)
  due_date date,
  delivered_at date, -- date de remise au fournisseur
  debited_at date,   -- date de débit bancaire
  scan_path text,
  print_batch_id uuid,
  cancellation_reason text,
  rejection_reason text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, bank_account_id)
    references public.bank_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, checkbook_id)
    references public.checkbooks (organization_id, id) on delete restrict,
  foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id) on delete restrict,
  foreign key (organization_id, print_batch_id)
    references public.print_batches (organization_id, id) on delete set null (print_batch_id),
  check (status = 'draft' or number is not null),
  check (type <> 'lcn' or due_date is not null),
  check (status <> 'cancelled' or cancellation_reason is not null)
);

-- Aucun doublon de numéro dans un même chéquier
create unique index payments_checkbook_number_idx
  on public.payments (checkbook_id, number)
  where number is not null;

create index payments_org_status_idx on public.payments (organization_id, status);
create index payments_supplier_idx on public.payments (supplier_id);
create index payments_org_number_idx on public.payments (organization_id, number);

-- -----------------------------------------------------------------------------
-- Affectations paiement ↔ facture (plusieurs-à-plusieurs avec montant)
-- -----------------------------------------------------------------------------

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, invoice_id),
  foreign key (organization_id, payment_id)
    references public.payments (organization_id, id) on delete cascade,
  foreign key (organization_id, invoice_id)
    references public.invoices (organization_id, id) on delete restrict
);

create index payment_allocations_invoice_idx on public.payment_allocations (invoice_id);

-- -----------------------------------------------------------------------------
-- Imports de relevés bancaires
-- -----------------------------------------------------------------------------

create table public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bank_account_id uuid not null,
  period_start date,
  period_end date,
  file_path text,
  -- Empreinte SHA-256 du fichier, pour détecter un relevé déjà importé
  file_hash text,
  format public.statement_format not null,
  status public.statement_import_status not null default 'pending',
  line_count integer not null default 0,
  error_message text,
  imported_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (bank_account_id, file_hash),
  foreign key (organization_id, bank_account_id)
    references public.bank_accounts (organization_id, id) on delete cascade,
  check (period_end is null or period_start is null or period_end >= period_start)
);

create table public.statement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  import_id uuid not null,
  bank_account_id uuid not null,
  operation_date date not null,
  value_date date,
  label text not null,
  reference text,
  debit numeric(14, 2) check (debit >= 0),
  credit numeric(14, 2) check (credit >= 0),
  -- Numéro de chèque / LCN extrait du libellé (zéros initiaux normalisés)
  extracted_number bigint,
  matched_payment_id uuid,
  -- Score de confiance du rapprochement, de 0 à 100
  confidence numeric(5, 2) check (confidence between 0 and 100),
  status public.statement_line_status not null default 'unmatched',
  -- Empreinte de la ligne, pour détecter les doublons entre imports
  line_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_account_id, line_hash),
  foreign key (organization_id, import_id)
    references public.statement_imports (organization_id, id) on delete cascade,
  foreign key (organization_id, bank_account_id)
    references public.bank_accounts (organization_id, id) on delete cascade,
  foreign key (organization_id, matched_payment_id)
    references public.payments (organization_id, id) on delete set null (matched_payment_id),
  check (coalesce(debit, 0) = 0 or coalesce(credit, 0) = 0)
);

create index statement_lines_import_idx on public.statement_lines (import_id);
create index statement_lines_payment_idx on public.statement_lines (matched_payment_id);
create index statement_lines_org_status_idx on public.statement_lines (organization_id, status);

-- -----------------------------------------------------------------------------
-- updated_at, audit et RLS
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'bank_accounts', 'print_templates', 'checkbooks', 'suppliers', 'invoices',
    'payments', 'statement_imports', 'statement_lines'
  ] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function private.set_updated_at()', t);
  end loop;

  -- Tables dont chaque modification est journalisée (avant/après)
  foreach t in array array[
    'bank_accounts', 'print_templates', 'checkbooks', 'suppliers', 'invoices',
    'payments', 'payment_allocations'
  ] loop
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$I
         for each row execute function private.audit_row_change()', t);
  end loop;
end;
$$;

-- Politiques standard : tout membre lit ; les rôles listés écrivent et suppriment.
-- Comptable et Expert-comptable externe sont en lecture seule partout.
do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('bank_accounts',       '{admin,manager}',          '{admin,manager}'),
      ('checkbooks',          '{admin,manager}',          '{admin,manager}'),
      ('suppliers',           '{admin,manager,preparer}', '{admin,manager}'),
      ('invoices',            '{admin,manager,preparer}', '{admin,manager}'),
      ('print_batches',       '{admin,manager,preparer}', '{admin,manager}'),
      ('payment_allocations', '{admin,manager,preparer}', '{admin,manager,preparer}'),
      ('statement_imports',   '{admin,manager}',          '{admin,manager}'),
      ('statement_lines',     '{admin,manager}',          '{admin,manager}')
    ) as v (table_name, write_roles, delete_roles)
  loop
    execute format('alter table public.%I enable row level security', rec.table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (organization_id in (select private.member_org_ids()))',
      rec.table_name || '_select', rec.table_name);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (organization_id in (select private.role_org_ids(%L)))',
      rec.table_name || '_insert', rec.table_name, rec.write_roles);

    execute format(
      'create policy %I on public.%I for update to authenticated
         using (organization_id in (select private.role_org_ids(%L)))
         with check (organization_id in (select private.role_org_ids(%L)))',
      rec.table_name || '_update', rec.table_name, rec.write_roles, rec.write_roles);

    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (organization_id in (select private.role_org_ids(%L)))',
      rec.table_name || '_delete', rec.table_name, rec.delete_roles);
  end loop;
end;
$$;

-- Modèles d'impression : les modèles par défaut (sans organisation) sont lisibles par tous.
alter table public.print_templates enable row level security;

create policy "print_templates_select" on public.print_templates
  for select to authenticated
  using (organization_id is null or organization_id in (select private.member_org_ids()));

create policy "print_templates_insert" on public.print_templates
  for insert to authenticated
  with check (organization_id in (select private.role_org_ids('{admin,manager}')));

create policy "print_templates_update" on public.print_templates
  for update to authenticated
  using (organization_id in (select private.role_org_ids('{admin,manager}')))
  with check (organization_id in (select private.role_org_ids('{admin,manager}')));

create policy "print_templates_delete" on public.print_templates
  for delete to authenticated
  using (organization_id in (select private.role_org_ids('{admin,manager}')));

-- Paiements : un paiement émis n'est jamais supprimé (il est annulé, avec motif) ;
-- seuls les brouillons peuvent l'être.
alter table public.payments enable row level security;

create policy "payments_select" on public.payments
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

create policy "payments_insert" on public.payments
  for insert to authenticated
  with check (organization_id in (select private.role_org_ids('{admin,manager,preparer}')));

create policy "payments_update" on public.payments
  for update to authenticated
  using (organization_id in (select private.role_org_ids('{admin,manager,preparer}')))
  with check (organization_id in (select private.role_org_ids('{admin,manager,preparer}')));

create policy "payments_delete_drafts" on public.payments
  for delete to authenticated
  using (
    status = 'draft'
    and organization_id in (select private.role_org_ids('{admin,manager,preparer}'))
  );
