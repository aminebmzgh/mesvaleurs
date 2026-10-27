-- =============================================================================
-- Relevés bancaires : correspondance des colonnes mémorisée par banque, solde du
-- compte tenu à jour, rapprochement avec les chèques et LCN émis.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Correspondance des colonnes d'un export, mémorisée par organisation et banque
-- -----------------------------------------------------------------------------

create table public.statement_column_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bank_id uuid not null references public.banks (id) on delete cascade,
  -- Libellés d'en-tête normalisés de l'export, pour reconnaître le même format
  header_signature text not null,
  mapping jsonb not null check (jsonb_typeof(mapping) = 'object'),
  updated_at timestamptz not null default now(),
  unique (organization_id, bank_id)
);

alter table public.statement_column_mappings enable row level security;

create policy "statement_column_mappings_select" on public.statement_column_mappings
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));
create policy "statement_column_mappings_insert" on public.statement_column_mappings
  for insert to authenticated
  with check (organization_id in (select private.role_org_ids('{admin,manager}')));
create policy "statement_column_mappings_update" on public.statement_column_mappings
  for update to authenticated
  using (organization_id in (select private.role_org_ids('{admin,manager}')))
  with check (organization_id in (select private.role_org_ids('{admin,manager}')));

create trigger statement_column_mappings_set_updated_at
  before update on public.statement_column_mappings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Lignes de relevé : type de formule extrait du libellé, motif du rapprochement
-- -----------------------------------------------------------------------------

alter table public.statement_lines
  add column extracted_kind text check (extracted_kind in ('check', 'lcn')),
  add column match_reason text;

-- Un paiement n'est rapproché (confirmé) qu'à une seule ligne de relevé
create unique index statement_lines_confirmed_payment_idx
  on public.statement_lines (matched_payment_id)
  where status in ('auto_matched', 'manually_matched');

-- -----------------------------------------------------------------------------
-- Solde courant : chaque mouvement importé (à partir de la date du solde
-- d'ouverture) l'ajuste ; la suppression d'un import l'annule.
-- -----------------------------------------------------------------------------

create or replace function private.statement_line_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  line public.statement_lines := coalesce(new, old);
  sign integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  update public.bank_accounts
  set current_balance = current_balance + sign * (coalesce(line.credit, 0) - coalesce(line.debit, 0))
  where id = line.bank_account_id
    and line.operation_date >= opening_balance_date;
  return null;
end;
$$;

create trigger statement_lines_balance
  after insert or delete on public.statement_lines
  for each row execute function private.statement_line_balance();

-- -----------------------------------------------------------------------------
-- Rapprochement. Fonctions exécutées avec les droits de l'utilisateur (RLS) :
-- administrateur ou gestionnaire.
-- -----------------------------------------------------------------------------

-- Statut d'un import : « à vérifier » tant qu'un débit reste à confirmer ou non rapproché
create or replace function private.refresh_import_status(target_import_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.statement_imports
  set status = case
    when exists (
      select 1 from public.statement_lines
      where import_id = target_import_id
        and coalesce(debit, 0) > 0
        and status in ('to_confirm', 'unmatched')
    ) then 'review'::public.statement_import_status
    else 'completed'::public.statement_import_status
  end
  where id = target_import_id;
$$;

-- Marque un paiement comme débité à la date de l'opération bancaire
create or replace function private.mark_payment_debited(target_payment_id uuid, line public.statement_lines)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.payments
  set status = 'paid', debited_at = line.operation_date
  where id = target_payment_id
    and bank_account_id = line.bank_account_id
    and status in ('issued', 'delivered');
  if not found then
    raise exception 'Ce paiement n''est plus en circulation sur ce compte.' using errcode = 'P0001';
  end if;
end;
$$;

-- Résultat du rapprochement automatique d'un import
-- p_matches : [{ "line_id", "payment_id", "status", "confidence", "reason" }]
create or replace function public.apply_statement_matches(p_import_id uuid, p_matches jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  match jsonb;
  line public.statement_lines;
begin
  for match in select value from jsonb_array_elements(p_matches) loop
    update public.statement_lines
    set matched_payment_id = nullif(match ->> 'payment_id', '')::uuid,
        status = (match ->> 'status')::public.statement_line_status,
        confidence = nullif(match ->> 'confidence', '')::numeric,
        match_reason = match ->> 'reason'
    where id = (match ->> 'line_id')::uuid
      and import_id = p_import_id
      and status in ('unmatched', 'to_confirm')
    returning * into line;
    if found and line.status = 'auto_matched' then
      perform private.mark_payment_debited(line.matched_payment_id, line);
    end if;
  end loop;
  perform private.refresh_import_status(p_import_id);
end;
$$;

-- Confirmation d'une proposition, ou rapprochement manuel d'une ligne avec un paiement
create or replace function public.confirm_statement_line(p_line_id uuid, p_payment_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  line public.statement_lines;
begin
  select * into line from public.statement_lines where id = p_line_id for update;
  if not found then
    raise exception 'Ligne de relevé introuvable.' using errcode = 'P0002';
  end if;
  if line.status in ('auto_matched', 'manually_matched') then
    raise exception 'Cette ligne est déjà rapprochée.' using errcode = 'P0001';
  end if;
  if coalesce(line.debit, 0) <= 0 then
    raise exception 'Seul un débit peut être rapproché d''un chèque ou d''une LCN.' using errcode = 'P0001';
  end if;

  perform private.mark_payment_debited(p_payment_id, line);
  update public.statement_lines
  set matched_payment_id = p_payment_id,
      status = 'manually_matched',
      confidence = coalesce(confidence, 100),
      match_reason = case when line.matched_payment_id = p_payment_id then match_reason else 'Rapprochement manuel' end
  where id = p_line_id;
  perform private.refresh_import_status(line.import_id);

  perform public.log_audit_event(line.organization_id, 'manual_match', 'statement_lines', p_line_id,
    jsonb_build_object('payment_id', p_payment_id));
end;
$$;

-- Défait un rapprochement : le paiement revient en circulation
create or replace function public.unmatch_statement_line(p_line_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  line public.statement_lines;
begin
  select * into line from public.statement_lines where id = p_line_id for update;
  if not found then
    raise exception 'Ligne de relevé introuvable.' using errcode = 'P0002';
  end if;
  if line.status in ('auto_matched', 'manually_matched') and line.matched_payment_id is not null then
    update public.payments
    set status = case when delivered_at is not null then 'delivered' else 'issued' end::public.payment_status
    where id = line.matched_payment_id and status = 'paid';
  end if;
  update public.statement_lines
  set matched_payment_id = null, status = 'unmatched', confidence = null, match_reason = 'Rapprochement défait'
  where id = p_line_id;
  perform private.refresh_import_status(line.import_id);

  perform public.log_audit_event(line.organization_id, 'unmatch', 'statement_lines', p_line_id,
    jsonb_build_object('payment_id', line.matched_payment_id));
end;
$$;

-- Ligne sans rapport avec un chèque ou une LCN (frais, virement…) : ignorée, ou de nouveau à traiter
create or replace function public.set_statement_line_ignored(p_line_id uuid, p_ignored boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  line public.statement_lines;
begin
  update public.statement_lines
  set status = case when p_ignored then 'ignored' else 'unmatched' end::public.statement_line_status,
      matched_payment_id = null,
      confidence = null
  where id = p_line_id
    and status in ('unmatched', 'to_confirm', 'ignored')
  returning * into line;
  if not found then
    raise exception 'Une ligne rapprochée doit d''abord être défaite.' using errcode = 'P0001';
  end if;
  perform private.refresh_import_status(line.import_id);
end;
$$;

revoke execute on function public.apply_statement_matches(uuid, jsonb) from anon, public;
revoke execute on function public.confirm_statement_line(uuid, uuid) from anon, public;
revoke execute on function public.unmatch_statement_line(uuid) from anon, public;
revoke execute on function public.set_statement_line_ignored(uuid, boolean) from anon, public;
grant execute on function public.apply_statement_matches(uuid, jsonb) to authenticated;
grant execute on function public.confirm_statement_line(uuid, uuid) to authenticated;
grant execute on function public.unmatch_statement_line(uuid) to authenticated;
grant execute on function public.set_statement_line_ignored(uuid, boolean) to authenticated;
