-- Relevés reçus par e-mail : adresse de réception renouvelable, boîte en lecture seule pour l'application.
begin;

select plan(11);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';

select matches(public.renew_statement_inbox('b0000000-0000-4000-8000-000000000001'), '^[a-z0-9]{12}$',
  'Le gestionnaire obtient une adresse de réception');
select set_config('test.first', (select statement_inbox_token from public.organizations where id = 'b0000000-0000-4000-8000-000000000001'), true);
select isnt(public.renew_statement_inbox('b0000000-0000-4000-8000-000000000001'), current_setting('test.first'),
  'Une nouvelle adresse remplace l''ancienne');

-- Relevé déposé par le serveur (webhook)
reset role;
insert into public.inbound_statements (id, organization_id, sender, subject, filename, content_type, size_bytes, file_path, provider_attachment_id)
values ('70000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'releves@banque.ma', 'Relevé octobre',
        'releve-octobre.csv', 'text/csv', 1200, 'b0000000-0000-4000-8000-000000000001/boite/x-releve.csv', 'att-1');
select throws_ok($$ insert into public.inbound_statements (organization_id, sender, filename, file_path, provider_attachment_id)
  values ('b0000000-0000-4000-8000-000000000001', 'x@y.ma', 'a.csv', 'p', 'att-1') $$,
  '23505', null, 'Webhook rejoué : pièce jointe non dupliquée');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';
select lives_ok($$ select public.set_inbound_statement_status('70000000-0000-4000-8000-000000000001', 'ignored') $$,
  'Le gestionnaire ignore un relevé reçu');
select is((select status from public.inbound_statements where id = '70000000-0000-4000-8000-000000000001'), 'ignored', 'Statut enregistré');
select throws_ok($$ select public.set_inbound_statement_status('70000000-0000-4000-8000-000000000001', 'imported', null) $$,
  '22023', null, 'Importé suppose un import de l''entreprise');
select throws_ok($$ update public.inbound_statements set status = 'pending' $$, '42501', null,
  'La boîte ne se modifie pas directement');

-- Le préparateur voit la boîte sans la gérer
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';
select is((select count(*)::int from public.inbound_statements), 1, 'Les membres voient les relevés reçus');
select throws_ok($$ select public.set_inbound_statement_status('70000000-0000-4000-8000-000000000001', 'pending') $$,
  'P0002', null, 'Le préparateur ne gère pas la boîte');
select throws_ok($$ select public.renew_statement_inbox('b0000000-0000-4000-8000-000000000001') $$,
  'P0002', null, 'Le préparateur ne renouvelle pas l''adresse');

-- Autre entreprise
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "souss@demo.ma", "aal": "aal1"}';
select is((select count(*)::int from public.inbound_statements), 0, 'Relevés invisibles des autres entreprises');

select * from finish();
rollback;
