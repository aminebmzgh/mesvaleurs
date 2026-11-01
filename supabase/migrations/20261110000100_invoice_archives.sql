-- Archivage légal des factures (spec §11 bis A) : chaque pièce d'une facture (fichier UBL
-- importé, PDF ou photo joints) est inscrite au registre des archives et conservée 10 ans,
-- non modifiable : ni le registre ni le fichier ne peuvent être modifiés ou supprimés,
-- administrateurs compris, et une facture archivée ne peut plus être supprimée.
-- L'empreinte SHA-256 du fichier, calculée par le serveur, permet d'en vérifier l'intégrité.

create table public.invoice_archives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  invoice_id uuid not null,
  bucket_id text not null default 'factures' check (bucket_id = 'factures'),
  file_path text not null,
  kind text not null check (kind in ('ubl', 'attachment')),
  -- Scellement : renseignés une seule fois, par le serveur
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint check (size_bytes >= 0),
  archived_at timestamptz not null default now(),
  -- Sans clé étrangère : l'archive survit au compte de son auteur
  archived_by uuid default auth.uid(),
  retain_until date not null default (current_date + interval '10 years')::date,
  unique (bucket_id, file_path),
  foreign key (organization_id, invoice_id) references public.invoices (organization_id, id) on delete restrict
);

create index invoice_archives_org_idx on public.invoice_archives (organization_id, archived_at desc);
create index invoice_archives_invoice_idx on public.invoice_archives (invoice_id);

-- Registre non modifiable : seul le scellement (empreinte encore vide) est permis, et la
-- suppression seulement après la durée de conservation
create or replace function private.protect_invoice_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.retain_until >= current_date then
      raise exception 'Archive conservée jusqu''au % : suppression impossible.', old.retain_until using errcode = '42501';
    end if;
    return old;
  end if;
  if old.sha256 is null and new.sha256 is not null
     and (new.id, new.organization_id, new.invoice_id, new.bucket_id, new.file_path, new.kind, new.archived_at, new.archived_by, new.retain_until)
       is not distinct from (old.id, old.organization_id, old.invoice_id, old.bucket_id, old.file_path, old.kind, old.archived_at, old.archived_by, old.retain_until) then
    return new;
  end if;
  raise exception 'Archive non modifiable.' using errcode = '42501';
end;
$$;

create trigger invoice_archives_protect
  before update or delete on public.invoice_archives
  for each row execute function private.protect_invoice_archive();

create trigger invoice_archives_audit
  after insert or update or delete on public.invoice_archives
  for each row execute function private.audit_row_change();

alter table public.invoice_archives enable row level security;

-- Consultation par tout membre ; inscription par la base seule (déclencheur ci-dessous)
create policy "invoice_archives_select" on public.invoice_archives
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

-- Toute pièce jointe d'une facture est inscrite au registre dès son enregistrement
create or replace function private.archive_invoice_attachment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.attachment_path is not null and new.attachment_path is distinct from coalesce(old.attachment_path, '') then
    insert into public.invoice_archives (organization_id, invoice_id, file_path, kind, archived_by)
    values (
      new.organization_id,
      new.id,
      new.attachment_path,
      case when lower(new.attachment_path) like '%.xml' then 'ubl' else 'attachment' end,
      auth.uid()
    )
    on conflict (bucket_id, file_path) do nothing;
  end if;
  return new;
end;
$$;

create trigger invoices_archive_attachment
  after insert or update of attachment_path on public.invoices
  for each row execute function private.archive_invoice_attachment();

-- Scellement par le serveur (clé de service), après calcul de l'empreinte du fichier
create or replace function public.seal_invoice_archive(p_id uuid, p_sha256 text, p_size bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invoice_archives
  set sha256 = p_sha256, size_bytes = p_size
  where id = p_id and sha256 is null;
$$;

revoke execute on function public.seal_invoice_archive(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.seal_invoice_archive(uuid, text, bigint) to service_role;

-- Pièces déjà jointes : archivées à partir d'aujourd'hui (empreinte calculée à la première vérification)
insert into public.invoice_archives (organization_id, invoice_id, file_path, kind, archived_by, archived_at)
select organization_id, id, attachment_path,
       case when lower(attachment_path) like '%.xml' then 'ubl' else 'attachment' end,
       null, coalesce(updated_at, created_at)
from public.invoices
where attachment_path is not null
on conflict (bucket_id, file_path) do nothing;

-- Fichiers archivés : ni remplacés ni supprimés dans le stockage
create or replace function private.is_archived_object(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.invoice_archives where bucket_id = p_bucket and file_path = p_name);
$$;

grant execute on function private.is_archived_object(text, text) to authenticated;

drop policy "org_documents_update" on storage.objects;
create policy "org_documents_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('releves', 'factures', 'cheques-scans', 'lettres')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager,preparer}'))
    and not private.is_archived_object(bucket_id, name)
  )
  with check (
    bucket_id in ('releves', 'factures', 'cheques-scans', 'lettres')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager,preparer}'))
  );

drop policy "org_documents_delete" on storage.objects;
create policy "org_documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('releves', 'factures', 'cheques-scans', 'lettres')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager}'))
    and not private.is_archived_object(bucket_id, name)
  );
