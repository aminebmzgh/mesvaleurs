-- =============================================================================
-- Prorogation et report des LCN (spec §11 bis E) : nouvelle échéance, motif,
-- accord du fournisseur, historique des reports. L'échéance du paiement est mise à
-- jour : prévisions et suivi des échéances la reprennent directement.
-- =============================================================================

create table public.lcn_postponements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  payment_id uuid not null,
  previous_due_date date not null,
  new_due_date date not null,
  reason text not null check (length(trim(reason)) between 3 and 300),
  -- Accord du fournisseur (bénéficiaire) : obligatoire pour reporter une échéance
  supplier_agreed_at date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, payment_id) references public.payments (organization_id, id) on delete cascade,
  check (new_due_date > previous_due_date)
);

create index lcn_postponements_payment_idx on public.lcn_postponements (payment_id, created_at);

alter table public.lcn_postponements enable row level security;

-- Lecture par les membres ; écriture uniquement par postpone_lcn
create policy "lcn_postponements_select" on public.lcn_postponements
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

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
  if p_supplier_agreed_at is null or p_supplier_agreed_at > current_date then
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

revoke execute on function public.postpone_lcn(uuid, date, text, date) from anon, public;
grant execute on function public.postpone_lcn(uuid, date, text, date) to authenticated;
