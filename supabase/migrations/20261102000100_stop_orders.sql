-- =============================================================================
-- Oppositions (spec §11 bis D) : perte ou vol d'un chèque ou d'une LCN émis, ou de
-- formules vierges d'un chéquier / carnet. Le paiement passe « en opposition » (il
-- ne règle plus ses factures) ; les formules vierges en opposition sont sautées à
-- l'émission. La lettre d'opposition (confirmation écrite à la banque) est générée
-- par l'application.
--
-- Cas d'opposition admis (Code de commerce, à faire valider par un juriste) :
-- chèque : perte, vol, utilisation frauduleuse, redressement ou liquidation
-- judiciaire du porteur ; LCN : perte (ou vol), redressement ou liquidation du
-- porteur ; formules vierges : perte ou vol.
-- =============================================================================

create type public.stop_order_reason as enum ('lost', 'stolen', 'fraudulent_use', 'holder_insolvency');

create table public.stop_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bank_account_id uuid not null,
  checkbook_id uuid not null,
  -- Paiement émis en opposition ; null : formules vierges first_number à last_number
  payment_id uuid,
  first_number bigint not null,
  last_number bigint not null,
  reason public.stop_order_reason not null,
  -- Date de la perte ou du vol constaté
  occurred_on date not null,
  -- Date de l'opposition auprès de la banque
  declared_on date not null default current_date,
  -- Références du récépissé de déclaration (police, gendarmerie)
  police_report text check (length(police_report) <= 120),
  notes text check (length(notes) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, bank_account_id) references public.bank_accounts (organization_id, id) on delete cascade,
  foreign key (organization_id, checkbook_id) references public.checkbooks (organization_id, id) on delete cascade,
  foreign key (organization_id, payment_id) references public.payments (organization_id, id) on delete cascade,
  check (last_number >= first_number),
  check (payment_id is null or first_number = last_number),
  check (occurred_on <= declared_on),
  -- Deux oppositions sur formules vierges d'un même carnet ne se chevauchent pas
  exclude using gist (
    checkbook_id with =,
    int8range(first_number, last_number, '[]') with &&
  ) where (payment_id is null)
);

create index stop_orders_account_idx on public.stop_orders (bank_account_id, declared_on desc);
create index stop_orders_payment_idx on public.stop_orders (payment_id) where payment_id is not null;

alter table public.stop_orders enable row level security;

-- Lecture par les membres ; écriture uniquement par stop_payment et stop_blank_forms
create policy "stop_orders_select" on public.stop_orders
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

-- -----------------------------------------------------------------------------
-- Dates saisies : date locale de l'utilisateur. current_date est en UTC sur le
-- serveur, et les données de fuseau de Casablanca diffèrent selon les systèmes :
-- « pas dans le futur » se vérifie par rapport à la date la plus avancée du globe
-- (UTC+14), la date de déclaration ne précède jamais celle du constat.
-- -----------------------------------------------------------------------------
create or replace function private.latest_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Etc/GMT-14')::date;
$$;

-- -----------------------------------------------------------------------------
-- Numéros attribuables d'un carnet : à la suite, sans les formules vierges en
-- opposition.
-- -----------------------------------------------------------------------------
create or replace function private.available_numbers(p_checkbook_id uuid, p_from bigint, p_to bigint, p_limit integer)
returns bigint[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(n order by n), '{}'::bigint[])
  from (
    select n
    from generate_series(p_from, p_to) as n
    where not exists (
      select 1 from public.stop_orders s
      where s.checkbook_id = p_checkbook_id and s.payment_id is null and n between s.first_number and s.last_number
    )
    order by n
    limit p_limit
  ) as candidates;
$$;

-- Prochain numéro : saute les formules en opposition qui suivent `p_from`
create or replace function private.next_available_number(p_checkbook_id uuid, p_from bigint, p_last bigint)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce((private.available_numbers(p_checkbook_id, p_from, p_last, 1))[1], p_last + 1);
$$;

-- -----------------------------------------------------------------------------
-- Synthèse des carnets : les formules vierges en opposition ne sont plus restantes.
-- -----------------------------------------------------------------------------
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
  greatest(
    c.last_number - c.next_number + 1 - (
      select coalesce(sum(least(s.last_number, c.last_number) - greatest(s.first_number, c.next_number) + 1), 0)
      from public.stop_orders s
      where s.checkbook_id = c.id and s.payment_id is null
        and s.last_number >= c.next_number and s.first_number <= c.last_number
    ),
    0
  )::integer as remaining_count,
  (select count(*) from public.payments p where p.checkbook_id = c.id and p.status = 'cancelled')::integer
    as cancelled_count,
  c.print_template_id,
  (
    select coalesce(sum(s.last_number - s.first_number + 1), 0)
    from public.stop_orders s
    where s.checkbook_id = c.id and s.payment_id is null
  )::integer as stopped_blank_count
from public.checkbooks c;

-- -----------------------------------------------------------------------------
-- Opposition sur un chèque ou une LCN émis (en circulation).
-- -----------------------------------------------------------------------------
create or replace function public.stop_payment(
  p_payment_id uuid,
  p_reason public.stop_order_reason,
  p_occurred_on date,
  p_police_report text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payments;
  stop_id uuid;
begin
  select * into payment from public.payments where id = p_payment_id for update;
  if not found or not private.has_role(payment.organization_id, array['admin', 'manager', 'preparer']::public.app_role[]) then
    raise exception 'Paiement introuvable.' using errcode = 'P0002';
  end if;
  if payment.type not in ('check', 'lcn', 'guarantee_check') or payment.checkbook_id is null then
    raise exception 'Seuls les chèques et les LCN peuvent faire l''objet d''une opposition.' using errcode = 'P0001';
  end if;
  if payment.status not in ('issued', 'delivered') then
    raise exception 'Seul un paiement en circulation (émis ou remis, non débité) peut être mis en opposition.' using errcode = 'P0001';
  end if;
  if p_reason is null
    or (payment.type = 'lcn' and p_reason = 'fraudulent_use') then
    raise exception 'Motif d''opposition non admis pour ce paiement.' using errcode = '22023';
  end if;
  if p_occurred_on is null or p_occurred_on > private.latest_today() or p_occurred_on < payment.issue_date then
    raise exception 'La date du constat doit être comprise entre l''émission et aujourd''hui.' using errcode = '22023';
  end if;

  insert into public.stop_orders (
    organization_id, bank_account_id, checkbook_id, payment_id, first_number, last_number,
    reason, occurred_on, declared_on, police_report, notes, created_by
  ) values (
    payment.organization_id, payment.bank_account_id, payment.checkbook_id, payment.id, payment.number, payment.number,
    p_reason, p_occurred_on, greatest(current_date, p_occurred_on), nullif(trim(p_police_report), ''), nullif(trim(p_notes), ''), auth.uid()
  )
  returning id into stop_id;

  -- En opposition : le paiement ne règle plus ses factures
  update public.payments set status = 'stopped' where id = p_payment_id;

  perform public.log_audit_event(payment.organization_id, 'stop', 'payments', p_payment_id,
    jsonb_build_object('stop_order_id', stop_id, 'reason', p_reason, 'occurred_on', p_occurred_on));
  return stop_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Opposition sur des formules vierges (perte ou vol d'un chéquier, de formules).
-- -----------------------------------------------------------------------------
create or replace function public.stop_blank_forms(
  p_checkbook_id uuid,
  p_first_number bigint,
  p_last_number bigint,
  p_reason public.stop_order_reason,
  p_occurred_on date,
  p_police_report text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  book public.checkbooks;
  stop_id uuid;
  new_next bigint;
begin
  select * into book from public.checkbooks where id = p_checkbook_id for update;
  if not found or not private.has_role(book.organization_id, array['admin', 'manager', 'preparer']::public.app_role[]) then
    raise exception 'Carnet introuvable.' using errcode = 'P0002';
  end if;
  if p_reason is null or p_reason not in ('lost', 'stolen') then
    raise exception 'Une opposition sur des formules vierges suppose une perte ou un vol.' using errcode = '22023';
  end if;
  if p_occurred_on is null or p_occurred_on > private.latest_today() then
    raise exception 'La date du constat ne peut pas être dans le futur.' using errcode = '22023';
  end if;
  if p_first_number is null or p_last_number is null or p_last_number < p_first_number
    or p_first_number < book.next_number or p_last_number > book.last_number then
    raise exception 'Les formules doivent être des formules non utilisées du carnet (n° % à %).',
      book.next_number, book.last_number using errcode = '22023';
  end if;
  if exists (
    select 1 from public.stop_orders s
    where s.checkbook_id = book.id and s.payment_id is null
      and s.first_number <= p_last_number and s.last_number >= p_first_number
  ) then
    raise exception 'Certaines de ces formules sont déjà en opposition.' using errcode = 'P0001';
  end if;

  insert into public.stop_orders (
    organization_id, bank_account_id, checkbook_id, first_number, last_number,
    reason, occurred_on, declared_on, police_report, notes, created_by
  ) values (
    book.organization_id, book.bank_account_id, book.id, p_first_number, p_last_number,
    p_reason, p_occurred_on, greatest(current_date, p_occurred_on), nullif(trim(p_police_report), ''), nullif(trim(p_notes), ''), auth.uid()
  )
  returning id into stop_id;

  -- Le prochain numéro saute les formules en opposition ; carnet épuisé s'il n'en reste plus
  new_next := private.next_available_number(book.id, book.next_number, book.last_number);
  if new_next <> book.next_number then
    update public.checkbooks
    set next_number = new_next,
        status = case when new_next > book.last_number and status = 'active' then 'exhausted' else status end
    where id = book.id;
  end if;

  perform public.log_audit_event(book.organization_id, 'stop', 'checkbooks', book.id,
    jsonb_build_object('stop_order_id', stop_id, 'reason', p_reason, 'first_number', p_first_number, 'last_number', p_last_number));
  return stop_id;
end;
$$;

revoke execute on function public.stop_payment(uuid, public.stop_order_reason, date, text, text) from anon, public;
grant execute on function public.stop_payment(uuid, public.stop_order_reason, date, text, text) to authenticated;
revoke execute on function public.stop_blank_forms(uuid, bigint, bigint, public.stop_order_reason, date, text, text) from anon, public;
grant execute on function public.stop_blank_forms(uuid, bigint, bigint, public.stop_order_reason, date, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Émission : les numéros sautent les formules vierges en opposition.
-- -----------------------------------------------------------------------------
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
  p_allocations jsonb default '[]'::jsonb,
  -- Chèque de garantie : { "purpose": "…", "return_due": "2027-03-31" } (sans affectation)
  p_guarantee jsonb default null
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
  numbers bigint[];
  new_next bigint;
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

  -- Chèque de garantie : remis sans intention d'encaissement, il ne règle aucune facture
  if p_guarantee is not null then
    if book.type <> 'check' then
      raise exception 'Un chèque de garantie s''émet depuis un chéquier.' using errcode = 'P0001';
    end if;
    if nullif(p_guarantee ->> 'return_due', '') is null or (p_guarantee ->> 'return_due')::date < p_issue_date then
      raise exception 'La date de restitution prévue doit suivre la date d''émission.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_allocations) > 0 then
      raise exception 'Un chèque de garantie ne règle aucune facture.' using errcode = '22023';
    end if;
    payment_type := 'guarantee_check';
  end if;

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
  numbers := private.available_numbers(book.id, book.next_number, book.last_number, instrument_count);
  if coalesce(array_length(numbers, 1), 0) < instrument_count then
    raise exception 'Formules insuffisantes : il reste % formule(s) dans ce carnet.',
      coalesce(array_length(numbers, 1), 0) using errcode = 'P0001';
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
      amount, issue_date, issue_place, due_date, print_batch_id, created_by,
      guarantee_purpose, guarantee_return_due
    ) values (
      p_organization_id, payment_type, 'issued', book.bank_account_id, book.id, numbers[slot + 1],
      p_supplier_id, payee, amount, p_issue_date, nullif(trim(p_issue_place), ''),
      case when payment_type = 'lcn' then due end, batch_id, auth.uid(),
      nullif(trim(p_guarantee ->> 'purpose'), ''), (p_guarantee ->> 'return_due')::date
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

  -- Avancement du carnet, au-delà des formules en opposition qui suivent
  new_next := private.next_available_number(book.id, numbers[instrument_count] + 1, book.last_number);
  update public.checkbooks
  set next_number = new_next,
      status = case when new_next > book.last_number then 'exhausted' else status end
  where id = book.id;

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, details)
  values (
    p_organization_id, auth.uid(), 'issue', 'print_batches', batch_id,
    jsonb_build_object(
      'checkbook_id', book.id,
      'first_number', numbers[1],
      'last_number', numbers[instrument_count],
      'payment_ids', to_jsonb(payment_ids)
    )
  );

  return batch_id;
end;
$$;
