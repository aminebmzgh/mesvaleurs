-- Date d'annulation d'un paiement, renseignée par la base (rapport de fin de mois).
alter table public.payments add column cancelled_at timestamptz;

update public.payments set cancelled_at = updated_at where status = 'cancelled';

-- Seule la base écrit cette date : à l'annulation, et jamais ensuite
-- (un retrait de droit par colonne serait sans effet, le droit étant accordé sur la table).
create or replace function private.payment_cancelled_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.cancelled_at := case when new.status = 'cancelled' then now() end;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
  else
    new.cancelled_at := old.cancelled_at;
  end if;
  return new;
end;
$$;

create trigger payments_cancelled_at
  before insert or update on public.payments
  for each row execute function private.payment_cancelled_at();
