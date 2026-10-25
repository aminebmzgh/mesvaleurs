-- =============================================================================
-- Stockage : buckets privés, chemins préfixés par l'organisation
-- (`<organization_id>/<...>`), politiques RLS sur storage.objects.
-- Les fichiers sont envoyés directement du navigateur via URL signées et lus
-- via des liens signés à durée limitée.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('releves', 'releves', false, 20971520, array[
    'application/pdf', 'text/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png'
  ]),
  ('factures', 'factures', false, 20971520, array[
    'application/pdf', 'image/jpeg', 'image/png', 'application/xml', 'text/xml'
  ]),
  ('cheques-scans', 'cheques-scans', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf']),
  ('lettres', 'lettres', false, 10485760, array['application/pdf']),
  ('modeles-impression', 'modeles-impression', false, 10485760, array['image/jpeg', 'image/png']),
  ('logos', 'logos', false, 2097152, array['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

-- Organisation propriétaire d'un objet, d'après le premier segment de son chemin.
-- Renvoie null si le chemin ne commence pas par un UUID valide.
create or replace function private.storage_object_org_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then split_part(object_name, '/', 1)::uuid
  end;
$$;

grant execute on function private.storage_object_org_id(text) to authenticated;

-- Lecture : tout membre de l'organisation, dans tous les buckets de l'application.
create policy "org_files_select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('releves', 'factures', 'cheques-scans', 'lettres', 'modeles-impression', 'logos')
    and private.storage_object_org_id(name) in (select private.member_org_ids())
  );

-- Documents opérationnels : rôles qui saisissent des paiements et des factures.
create policy "org_documents_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('releves', 'factures', 'cheques-scans', 'lettres')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager,preparer}'))
  );

create policy "org_documents_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('releves', 'factures', 'cheques-scans', 'lettres')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager,preparer}'))
  )
  with check (
    bucket_id in ('releves', 'factures', 'cheques-scans', 'lettres')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager,preparer}'))
  );

create policy "org_documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('releves', 'factures', 'cheques-scans', 'lettres')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager}'))
  );

-- Paramétrage (logo, fonds de formules) : administrateurs et gestionnaires.
create policy "org_settings_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('modeles-impression', 'logos')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager}'))
  );

create policy "org_settings_files_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('modeles-impression', 'logos')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager}'))
  )
  with check (
    bucket_id in ('modeles-impression', 'logos')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager}'))
  );

create policy "org_settings_files_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('modeles-impression', 'logos')
    and private.storage_object_org_id(name) in (select private.role_org_ids('{admin,manager}'))
  );
