-- =============================================================================
-- Relevés reçus par e-mail (#37) : chaque entreprise a une adresse de réception
-- propre et secrète (releves-<jeton>@import.mesvaleurs.ma). Resend reçoit les
-- e-mails et prévient le serveur (webhook signé), qui range les pièces jointes
-- dans la boîte de l'entreprise ; l'import se fait ensuite depuis l'application
-- (lecture dans le navigateur, vérification, rapprochement).
-- =============================================================================

-- Jeton de l'adresse de réception : 12 caractères, renouvelable (l'ancienne adresse cesse de fonctionner)
alter table public.organizations
  add column statement_inbox_token text unique check (statement_inbox_token ~ '^[a-z0-9]{12}$');

create table public.inbound_statements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  received_at timestamptz not null default now(),
  sender text not null check (length(sender) <= 320),
  subject text check (length(subject) <= 500),
  filename text not null check (length(filename) between 1 and 255),
  content_type text,
  size_bytes integer check (size_bytes >= 0),
  -- Bucket releves, sous <organisation>/boite/
  file_path text not null,
  status text not null default 'pending' check (status in ('pending', 'imported', 'ignored')),
  statement_import_id uuid references public.statement_imports (id) on delete set null,
  -- Identifiant Resend de la pièce jointe : un webhook rejoué n'ajoute pas de doublon
  provider_attachment_id text not null unique,
  created_at timestamptz not null default now()
);

create index inbound_statements_organization_idx on public.inbound_statements (organization_id, status, received_at desc);

create trigger inbound_statements_audit
  after insert or update or delete on public.inbound_statements
  for each row execute function private.audit_row_change();

alter table public.inbound_statements enable row level security;

create policy "inbound_statements_select" on public.inbound_statements
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

-- Ajout par le serveur (clé service_role) ; statut changé par les fonctions ci-dessous
revoke all on public.inbound_statements from anon, authenticated;
grant select on public.inbound_statements to authenticated;

-- Nouvelle adresse de réception (ou première) : direction et gestion des comptes
create or replace function public.renew_statement_inbox(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  if not private.has_role(p_organization_id, array['admin', 'manager']::public.app_role[]) then
    raise exception 'Action réservée aux administrateurs et gestionnaires.' using errcode = 'P0002';
  end if;
  loop
    token := lower(substr(translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', ''), 1, 12));
    exit when token ~ '^[a-z0-9]{12}$' and not exists (select 1 from public.organizations where statement_inbox_token = token);
  end loop;
  update public.organizations set statement_inbox_token = token where id = p_organization_id;
  return token;
end;
$$;

-- Relevé reçu importé (avec son import) ou ignoré, ou remis en attente
create or replace function public.set_inbound_statement_status(p_id uuid, p_status text, p_import_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.inbound_statements;
begin
  select * into item from public.inbound_statements where id = p_id for update;
  if not found or not private.has_role(item.organization_id, array['admin', 'manager']::public.app_role[]) then
    raise exception 'Relevé introuvable.' using errcode = 'P0002';
  end if;
  if p_status not in ('pending', 'imported', 'ignored') then
    raise exception 'Statut invalide.' using errcode = '22023';
  end if;
  if p_status = 'imported' and (p_import_id is null
     or not exists (select 1 from public.statement_imports where id = p_import_id and organization_id = item.organization_id)) then
    raise exception 'Import introuvable.' using errcode = '22023';
  end if;
  update public.inbound_statements
  set status = p_status, statement_import_id = case when p_status = 'imported' then p_import_id end
  where id = p_id;
end;
$$;

revoke execute on function public.renew_statement_inbox(uuid) from public, anon;
revoke execute on function public.set_inbound_statement_status(uuid, text, uuid) from public, anon;
grant execute on function public.renew_statement_inbox(uuid) to authenticated;
grant execute on function public.set_inbound_statement_status(uuid, text, uuid) to authenticated;
