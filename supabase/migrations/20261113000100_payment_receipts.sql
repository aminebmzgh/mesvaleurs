-- =============================================================================
-- Accusé de réception fournisseur (spec §11 bis G) : à la remise des chèques et
-- LCN, le fournisseur ou son livreur signe à l'écran (nom, CIN facultative,
-- signature, photo des valeurs). La date de remise signée devient la date de
-- remise des paiements (date de paiement retenue pour la loi 69-21).
-- Signature et photo : bucket cheques-scans, sous <organisation>/accuses/,
-- ni remplaçables ni supprimables une fois l'accusé enregistré.
-- =============================================================================

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  -- « AR-2026-0001 » : numéroté par entreprise et par année
  reference text not null,
  signed_at timestamptz not null default now(),
  delivered_on date not null,
  signer_name text not null check (length(trim(signer_name)) between 2 and 120),
  signer_id_number text check (length(trim(signer_id_number)) between 1 and 20),
  signature_path text not null,
  photo_path text,
  emailed_at timestamptz,
  emailed_to text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organization_id, reference)
);

create table public.payment_receipt_items (
  receipt_id uuid not null references public.payment_receipts (id) on delete cascade,
  -- Une valeur n'est remise (et signée) qu'une fois
  payment_id uuid primary key references public.payments (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete cascade
);

create index payment_receipts_organization_idx on public.payment_receipts (organization_id, signed_at desc);
create index payment_receipt_items_receipt_idx on public.payment_receipt_items (receipt_id);

create trigger payment_receipts_audit
  after insert or update or delete on public.payment_receipts
  for each row execute function private.audit_row_change();

alter table public.payment_receipts enable row level security;
alter table public.payment_receipt_items enable row level security;

create policy "payment_receipts_select" on public.payment_receipts
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

create policy "payment_receipt_items_select" on public.payment_receipt_items
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

-- Écriture par les fonctions ci-dessous seulement (Supabase accorde tout par défaut)
revoke all on public.payment_receipts, public.payment_receipt_items from anon, authenticated;
grant select on public.payment_receipts, public.payment_receipt_items to authenticated;

-- -----------------------------------------------------------------------------
-- Enregistrement de la remise signée
-- -----------------------------------------------------------------------------

create or replace function public.record_payment_receipt(
  p_payment_ids uuid[],
  p_delivered_on date,
  p_signer_name text,
  p_signer_id_number text,
  p_signature_path text,
  p_photo_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  supplier uuid;
  found_count integer;
  receipt_id uuid;
  next_number integer;
  year_text text := to_char(p_delivered_on, 'YYYY');
begin
  if coalesce(cardinality(p_payment_ids), 0) = 0 then
    raise exception 'Choisissez au moins une valeur remise.' using errcode = '22023';
  end if;

  select min(organization_id::text)::uuid, min(supplier_id::text)::uuid, count(*)
  into org_id, supplier, found_count
  from public.payments
  where id = any (p_payment_ids);

  if found_count <> cardinality(p_payment_ids) or org_id is null
     or not private.has_role(org_id, array['admin', 'manager', 'preparer']::public.app_role[]) then
    raise exception 'Paiement introuvable.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.payments where id = any (p_payment_ids) and (organization_id <> org_id or supplier_id <> supplier)) then
    raise exception 'Les valeurs remises doivent être destinées au même fournisseur.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.payments
    where id = any (p_payment_ids)
      and (type not in ('check', 'lcn', 'guarantee_check') or status not in ('issued', 'delivered'))
  ) then
    raise exception 'Seuls des chèques et LCN émis, non encore débités, peuvent être remis.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payment_receipt_items where payment_id = any (p_payment_ids)) then
    raise exception 'Une de ces valeurs a déjà un accusé de réception signé.' using errcode = 'P0001';
  end if;
  if p_delivered_on is null or p_delivered_on > private.latest_today()
     or exists (select 1 from public.payments where id = any (p_payment_ids) and issue_date > p_delivered_on) then
    raise exception 'Date de remise invalide.' using errcode = '22023';
  end if;
  if p_signature_path is null or p_signature_path not like org_id::text || '/accuses/%'
     or (p_photo_path is not null and p_photo_path not like org_id::text || '/accuses/%') then
    raise exception 'Signature invalide.' using errcode = '22023';
  end if;

  -- Numéro suivant de l'année, sans doublon entre deux remises simultanées
  perform pg_advisory_xact_lock(hashtextextended('payment_receipts:' || org_id::text, 0));
  select coalesce(max(split_part(reference, '-', 3)::integer), 0) + 1 into next_number
  from public.payment_receipts
  where organization_id = org_id and reference like 'AR-' || year_text || '-%';

  insert into public.payment_receipts
    (organization_id, supplier_id, reference, delivered_on, signer_name, signer_id_number, signature_path, photo_path)
  values
    (org_id, supplier, 'AR-' || year_text || '-' || lpad(next_number::text, 4, '0'), p_delivered_on,
     trim(p_signer_name), nullif(trim(p_signer_id_number), ''), p_signature_path, p_photo_path)
  returning id into receipt_id;

  insert into public.payment_receipt_items (receipt_id, payment_id, organization_id)
  select receipt_id, unnest(p_payment_ids), org_id;

  -- La date de remise signée fait foi
  update public.payments
  set status = 'delivered', delivered_at = p_delivered_on
  where id = any (p_payment_ids);

  return receipt_id;
end;
$$;

-- Reçu envoyé par e-mail au fournisseur : date et adresse conservées
create or replace function public.mark_receipt_emailed(p_receipt_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_receipts
  set emailed_at = now(), emailed_to = left(trim(p_email), 254)
  where id = p_receipt_id
    and private.has_role(organization_id, array['admin', 'manager', 'preparer']::public.app_role[]);
  if not found then
    raise exception 'Accusé de réception introuvable.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.record_payment_receipt(uuid[], date, text, text, text, text) from public, anon;
revoke execute on function public.mark_receipt_emailed(uuid, text) from public, anon;
grant execute on function public.record_payment_receipt(uuid[], date, text, text, text, text) to authenticated;
grant execute on function public.mark_receipt_emailed(uuid, text) to authenticated;

-- Signature et photo d'un accusé : protégées comme les pièces archivées
create or replace function private.is_archived_object(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.invoice_archives where bucket_id = p_bucket and file_path = p_name)
      or (p_bucket = 'cheques-scans'
          and exists (select 1 from public.payment_receipts where signature_path = p_name or photo_path = p_name));
$$;
