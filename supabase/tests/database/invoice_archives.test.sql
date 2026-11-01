-- Archivage légal : pièces des factures inscrites au registre, non modifiables, scellées par le serveur.
begin;

select plan(11);

-- Préparateur : joint une pièce à une facture
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

update public.invoices
set attachment_path = 'b0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000002/11111111-1111-4111-8111-111111111111.pdf'
where id = 'f0000000-0000-4000-8000-000000000002';

select is(
  (select kind from public.invoice_archives where invoice_id = 'f0000000-0000-4000-8000-000000000002'),
  'attachment', 'Pièce jointe inscrite au registre des archives');
select is(
  (select retain_until from public.invoice_archives where invoice_id = 'f0000000-0000-4000-8000-000000000002'),
  (current_date + interval '10 years')::date, 'Conservée 10 ans');
select ok(
  private.is_archived_object('factures', 'b0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000002/11111111-1111-4111-8111-111111111111.pdf'),
  'Fichier verrouillé dans le stockage');

-- Pièce remplacée par un fichier UBL : les deux restent archivées
update public.invoices
set attachment_path = 'b0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000002/22222222-2222-4222-8222-222222222222.xml'
where id = 'f0000000-0000-4000-8000-000000000002';
select results_eq(
  $$ select kind from public.invoice_archives where invoice_id = 'f0000000-0000-4000-8000-000000000002' order by kind $$,
  array['attachment', 'ubl'], 'Ancienne et nouvelle pièces archivées');

select throws_ok($$
  insert into public.invoice_archives (organization_id, invoice_id, file_path, kind)
  values ('b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 'x.pdf', 'attachment')
$$, '42501', null, 'Inscription directe refusée');
select throws_ok($$ select public.seal_invoice_archive(gen_random_uuid(), repeat('a', 64), 1) $$, '42501', null,
  'Scellement réservé au serveur');

-- Administrateur : ni modification, ni suppression, ni suppression de la facture
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated", "email": "admin@demo.ma", "aal": "aal2"}';
reset role;
select throws_ok($$
  update public.invoice_archives set file_path = 'autre.pdf' where invoice_id = 'f0000000-0000-4000-8000-000000000002'
$$, '42501', 'Archive non modifiable.', 'Registre non modifiable, même sans RLS');
select throws_ok($$
  delete from public.invoice_archives where invoice_id = 'f0000000-0000-4000-8000-000000000002'
$$, '42501', null, 'Suppression impossible pendant la durée de conservation');
select throws_ok($$
  delete from public.invoices where id = 'f0000000-0000-4000-8000-000000000002'
$$, '23503', null, 'Facture archivée non supprimable');

-- Scellement par la clé de service : une seule fois
set local role service_role;
select public.seal_invoice_archive(id, repeat('a', 64), 1234)
from public.invoice_archives where kind = 'ubl' and invoice_id = 'f0000000-0000-4000-8000-000000000002';
select public.seal_invoice_archive(id, repeat('b', 64), 1)
from public.invoice_archives where kind = 'ubl' and invoice_id = 'f0000000-0000-4000-8000-000000000002';
select is(
  (select sha256 from public.invoice_archives where kind = 'ubl' and invoice_id = 'f0000000-0000-4000-8000-000000000002'),
  repeat('a', 64), 'Empreinte scellée une seule fois');
select is(
  (select size_bytes from public.invoice_archives where kind = 'ubl' and invoice_id = 'f0000000-0000-4000-8000-000000000002'),
  1234::bigint, 'Taille enregistrée au scellement');

select * from finish();
rollback;
