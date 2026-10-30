-- =============================================================================
-- Dates saisies « pas dans le futur » : comparées à la date la plus avancée du globe
-- (private.latest_today, UTC+14) et non à current_date (UTC sur le serveur). Une
-- date du jour saisie au Maroc entre minuit et 1 h était refusée.
-- Corps des fonctions inchangés par ailleurs.
-- =============================================================================

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
  if p_kind is null or p_rejected_on is null or p_rejected_on > private.latest_today() or p_rejected_on < payment.issue_date then
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
  if p_method is null or p_regularized_on is null or p_regularized_on > private.latest_today() or p_regularized_on < payment.rejected_at then
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

create or replace function public.postpone_lcn(
  p_payment_id uuid,
  p_new_due_date date,
  p_reason text,
  p_supplier_agreed_at date
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
  if payment.type <> 'lcn' or payment.status not in ('issued', 'delivered') then
    raise exception 'Seule une LCN en circulation peut être reportée.' using errcode = 'P0001';
  end if;
  if p_new_due_date is null or p_new_due_date <= payment.due_date then
    raise exception 'La nouvelle échéance doit être postérieure à l''échéance actuelle.' using errcode = '22023';
  end if;
  if p_supplier_agreed_at is null or p_supplier_agreed_at > private.latest_today() then
    raise exception 'Indiquez la date de l''accord du fournisseur.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Indiquez le motif du report.' using errcode = '22023';
  end if;

  insert into public.lcn_postponements (organization_id, payment_id, previous_due_date, new_due_date, reason, supplier_agreed_at, created_by)
  values (payment.organization_id, payment.id, payment.due_date, p_new_due_date, trim(p_reason), p_supplier_agreed_at, auth.uid());

  update public.payments set due_date = p_new_due_date where id = p_payment_id;

  perform public.log_audit_event(payment.organization_id, 'postpone', 'payments', p_payment_id,
    jsonb_build_object('previous_due_date', payment.due_date, 'new_due_date', p_new_due_date));
end;
$$;

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
  if p_outcome is null or p_closed_on is null or p_closed_on > private.latest_today() or p_closed_on < payment.issue_date then
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
