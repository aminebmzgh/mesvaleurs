-- =============================================================================
-- Verrouillage après plusieurs échecs de connexion : compteur d'échecs par
-- adresse e-mail et par adresse IP (empreintes SHA-256, jamais en clair), tenu
-- par l'action de connexion du serveur avec la clé service_role.
-- =============================================================================

create table public.login_lockouts (
  -- Empreinte de « email:<adresse> » ou « ip:<adresse> »
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  failures integer not null default 0 check (failures >= 0),
  window_start timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Aucun accès depuis l'application : seule la clé service_role (qui contourne la RLS) y touche
alter table public.login_lockouts enable row level security;
revoke all on public.login_lockouts from anon, authenticated;

-- Fin du verrouillage en cours pour l'une des clés, ou null
create or replace function public.login_locked_until(p_keys text[])
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(locked_until)
  from public.login_lockouts
  where key = any (p_keys) and locked_until > now();
$$;

-- Enregistre un échec ; verrouille la clé quand le seuil est atteint dans la fenêtre.
-- Une fois le verrouillage échu, le compteur repart de zéro.
create or replace function public.record_login_failure(
  p_key text,
  p_max_failures integer,
  p_window interval,
  p_lock interval
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.login_lockouts;
begin
  -- Nettoyage des compteurs inactifs depuis plus d'un jour
  delete from public.login_lockouts
  where updated_at < now() - interval '1 day' and coalesce(locked_until, '-infinity') < now();

  insert into public.login_lockouts as l (key, failures, window_start)
  values (p_key, 1, now())
  on conflict (key) do update set
    failures = case
      when l.window_start < now() - p_window or l.locked_until <= now() then 1
      else l.failures + 1
    end,
    window_start = case
      when l.window_start < now() - p_window or l.locked_until <= now() then now()
      else l.window_start
    end,
    locked_until = case when l.locked_until <= now() then null else l.locked_until end,
    updated_at = now()
  returning * into result;

  if result.failures >= p_max_failures and result.locked_until is null then
    update public.login_lockouts
    set locked_until = now() + p_lock
    where key = p_key
    returning * into result;
  end if;
  return case when result.locked_until > now() then result.locked_until end;
end;
$$;

-- Connexion réussie : le compteur de l'adresse e-mail est remis à zéro
create or replace function public.clear_login_failures(p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.login_lockouts where key = p_key;
$$;

revoke execute on function public.login_locked_until(text[]) from public, anon, authenticated;
revoke execute on function public.record_login_failure(text, integer, interval, interval) from public, anon, authenticated;
revoke execute on function public.clear_login_failures(text) from public, anon, authenticated;
grant execute on function public.login_locked_until(text[]) to service_role;
grant execute on function public.record_login_failure(text, integer, interval, interval) to service_role;
grant execute on function public.clear_login_failures(text) to service_role;

-- Nettoyage des compteurs inactifs (à chaque échec)
create index login_lockouts_updated_at_idx on public.login_lockouts (updated_at);
