-- =============================================================================
-- Chèques et LCN rejetés (impayés) et régularisation (loi 71-24, spec §11 bis B).
-- Un rejet ouvre un délai de régularisation (paramètre légal, un mois par défaut,
-- à faire valider par un juriste) ; la régularisation se fait par nouvelle
-- provision (représentation du chèque), chèque ou LCN de remplacement, virement,
-- ou autre moyen noté.
-- =============================================================================

create type public.rejection_kind as enum ('insufficient_funds', 'signature', 'stop_order', 'irregularity', 'other');
create type public.regularization_method as enum ('new_provision', 'replacement', 'transfer', 'other');

alter table public.payments
  add column rejected_at date,
  add column rejection_kind public.rejection_kind,
  add column regularization_due_date date,
  add column regularized_at date,
  add column regularization_method public.regularization_method,
  add column replacement_payment_id uuid,
  add column regularization_notes text check (length(regularization_notes) <= 500),
  add constraint payments_replacement_fk foreign key (organization_id, replacement_payment_id)
    references public.payments (organization_id, id) on delete set null (replacement_payment_id),
  -- Un paiement rejeté porte sa date et son motif
  add constraint payments_rejection_details
    check (status <> 'rejected' or (rejected_at is not null and rejection_kind is not null));

create index payments_org_rejected_idx on public.payments (organization_id, regularization_due_date)
  where status = 'rejected';

insert into public.legal_settings (key, value, description) values
  ('rejected_check_regularization_months', 1,
   'Délai de régularisation d''un chèque rejeté, en mois à compter du rejet (loi 71-24, à valider par un juriste).');

-- -----------------------------------------------------------------------------
-- Déclaration d'un rejet : depuis une ligne de relevé ou saisie manuelle.
-- -----------------------------------------------------------------------------
create or replace function public.reject_payment(
  p_payment_id uuid,
  p_kind public.rejection_kind,
  p_reason text,
  p_rejected_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payments;
  months numeric;
begin
  select * into payment from public.payments where id = p_payment_id for update;
  if not found or not private.has_role(payment.organization_id, array['admin', 'manager', 'preparer']::public.app_role[]) then
    raise exception 'Paiement introuvable.' using errcode = 'P0002';
  end if;
  if payment.type not in ('check', 'lcn') then
    raise exception 'Seuls les chèques et les LCN peuvent être rejetés.' using errcode = 'P0001';
  end if;
  if payment.status not in ('issued', 'delivered', 'paid') then
    raise exception 'Ce paiement n''est pas en circulation : il ne peut pas être rejeté.' using errcode = 'P0001';
  end if;
  if p_kind is null or p_rejected_on is null or p_rejected_on > current_date or p_rejected_on < payment.issue_date then
    raise exception 'Motif ou date de rejet invalide.' using errcode = '22023';
  end if;

  select value into months from public.legal_settings where key = 'rejected_check_regularization_months';

  update public.payments
  set status = 'rejected',
      rejection_kind = p_kind,
      rejection_reason = nullif(trim(p_reason), ''),
      rejected_at = p_rejected_on,
      -- Délai légal pour les chèques ; une LCN impayée se suit sans compte à rebours
      regularization_due_date = case
        when payment.type = 'check' then (p_rejected_on + make_interval(months => coalesce(months, 1)::integer))::date
      end,
      regularized_at = null,
      regularization_method = null,
      replacement_payment_id = null,
      regularization_notes = null
  where id = p_payment_id;

  perform public.log_audit_event(payment.organization_id, 'reject', 'payments', p_payment_id,
    jsonb_build_object('kind', p_kind, 'rejected_on', p_rejected_on));
end;
$$;

-- -----------------------------------------------------------------------------
-- Régularisation d'un rejet.
--   new_provision : le chèque est représenté (retour en circulation) ;
--   replacement / transfer : un nouveau paiement (même fournisseur) le remplace,
--     l'original est annulé — les factures sont réglées par le remplaçant ;
--   other : moyen noté, le paiement reste rejeté mais régularisé.
-- -----------------------------------------------------------------------------
create or replace function public.regularize_payment(
  p_payment_id uuid,
  p_method public.regularization_method,
  p_regularized_on date,
  p_replacement_payment_id uuid default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payments;
  replacement public.payments;
  replacement_label text;
begin
  select * into payment from public.payments where id = p_payment_id for update;
  if not found or not private.has_role(payment.organization_id, array['admin', 'manager', 'preparer']::public.app_role[]) then
    raise exception 'Paiement introuvable.' using errcode = 'P0002';
  end if;
  if payment.status <> 'rejected' or payment.regularized_at is not null then
    raise exception 'Ce paiement n''est pas un rejet à régulariser.' using errcode = 'P0001';
  end if;
  if p_method is null or p_regularized_on is null or p_regularized_on > current_date or p_regularized_on < payment.rejected_at then
    raise exception 'Mode ou date de régularisation invalide.' using errcode = '22023';
  end if;

  if p_method in ('replacement', 'transfer') then
    select * into replacement from public.payments
    where id = p_replacement_payment_id
      and organization_id = payment.organization_id
      and supplier_id = payment.supplier_id
      and id <> payment.id
      and status not in ('draft', 'cancelled', 'rejected');
    if not found then
      raise exception 'Paiement de remplacement introuvable (même fournisseur, en circulation ou débité).' using errcode = 'P0002';
    end if;
    if (p_method = 'transfer') <> (replacement.type = 'transfer') then
      raise exception 'Le paiement de remplacement ne correspond pas au mode choisi.' using errcode = '22023';
    end if;
    replacement_label := case replacement.type
      when 'transfer' then 'virement ' || coalesce(replacement.reference, '')
      when 'lcn' then 'LCN n° ' || replacement.number
      else 'chèque n° ' || replacement.number
    end;
  elsif p_method = 'other' and nullif(trim(p_notes), '') is null then
    raise exception 'Précisez le moyen de régularisation.' using errcode = '22023';
  end if;

  update public.payments
  set regularized_at = p_regularized_on,
      regularization_method = p_method,
      replacement_payment_id = case when p_method in ('replacement', 'transfer') then replacement.id end,
      regularization_notes = nullif(trim(p_notes), ''),
      status = case p_method
        when 'new_provision' then (case when payment.delivered_at is not null then 'delivered' else 'issued' end)::public.payment_status
        when 'other' then 'rejected'::public.payment_status
        else 'cancelled'::public.payment_status
      end,
      cancellation_reason = case
        when p_method in ('replacement', 'transfer') then 'Rejeté, remplacé par ' || replacement_label
        else cancellation_reason
      end
  where id = p_payment_id;

  perform public.log_audit_event(payment.organization_id, 'regularize', 'payments', p_payment_id,
    jsonb_build_object('method', p_method, 'regularized_on', p_regularized_on, 'replacement_payment_id', replacement.id));
end;
$$;

revoke execute on function public.reject_payment(uuid, public.rejection_kind, text, date) from anon, public;
grant execute on function public.reject_payment(uuid, public.rejection_kind, text, date) to authenticated;
revoke execute on function public.regularize_payment(uuid, public.regularization_method, date, uuid, text) from anon, public;
grant execute on function public.regularize_payment(uuid, public.regularization_method, date, uuid, text) to authenticated;
