-- Journal d'audit : tables journalisées et droits de consultation (données du seed).
begin;

select plan(7);

-- Administrateur de A : une invitation est journalisée avec son auteur
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated", "email": "admin@demo.ma", "aal": "aal1"}';

insert into public.invitations (organization_id, email, role)
values ('b0000000-0000-4000-8000-000000000001', 'nouveau@demo.ma', 'preparer');

select is(
  (select actor_name from public.audit_entries where table_name = 'invitations' and action = 'insert' and after ->> 'email' = 'nouveau@demo.ma'),
  'Karim Benali',
  'Une invitation est journalisée, avec le nom de son auteur'
);

update public.bank_accounts set label = 'Compte principal (renommé)'
where organization_id = 'b0000000-0000-4000-8000-000000000001' and label = 'Compte principal';
select is(
  (select before ->> 'label' from public.audit_entries
   where table_name = 'bank_accounts' and action = 'update' and after ->> 'label' = 'Compte principal (renommé)'),
  'Compte principal',
  'Une modification garde l''état avant et après'
);

-- Comptable de A : lecture du journal de son entreprise uniquement
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';
select ok((select count(*) from public.audit_entries) > 0, 'Comptable : voit le journal de son entreprise');
select is_empty(
  $$ select id from public.audit_entries where organization_id <> 'b0000000-0000-4000-8000-000000000001' $$,
  'Comptable : aucune entrée d''une autre entreprise'
);

-- Préparateur : pas d'accès au journal
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';
select is_empty($$ select id from public.audit_entries $$, 'Préparateur : journal invisible');

-- Administrateur de B : rien de l'entreprise A
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "souss@demo.ma", "aal": "aal1"}';
select is_empty(
  $$ select id from public.audit_entries where organization_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'Autre entreprise : aucune entrée de A'
);

-- Anonyme : aucun droit sur la vue
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select id from public.audit_entries $$, '42501', null, 'Anonyme : accès refusé à la vue');

select * from finish();
rollback;
