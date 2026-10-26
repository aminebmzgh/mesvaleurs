-- =============================================================================
-- Impression : options des modèles, suivi des impressions et réimpressions.
-- =============================================================================

-- Options d'un modèle (encadrement du montant, police, majuscules), validées par l'application
alter table public.print_templates
  add column options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  add column source_key text;

comment on column public.print_templates.source_key is
  'Modèle par défaut d''origine (ex. check-awb), pour information.';

-- Nombre d'impressions d'un lot : la première est une impression, les suivantes des réimpressions
alter table public.print_batches
  add column print_count integer not null default 0 check (print_count >= 0);

-- Enregistre une impression (ou réimpression) d'un lot et la journalise.
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

revoke execute on function public.record_batch_print(uuid) from anon, public;
grant execute on function public.record_batch_print(uuid) to authenticated;

-- Synthèse des carnets : ajout du modèle d'impression associé (colonne en fin de vue)
create or replace view public.checkbook_summaries
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
    as cancelled_count,
  c.print_template_id
from public.checkbooks c;
