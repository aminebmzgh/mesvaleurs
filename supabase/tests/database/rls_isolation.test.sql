-- =============================================================================
-- Tests d'isolation multi-tenant et de rôles (pgTAP), sur les données du seed.
-- Exécution : pnpm db:test (supabase test db)
--
--   Organisation A : Atlas Distribution (admin, gestionnaire, préparateur, comptable)
--   Organisation B : Souss Négoce (souss@demo.ma, administrateur)
-- =============================================================================

begin;

select plan(33);

-- Toutes les tables du schéma public ont la RLS activée
select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'La RLS est activée sur toutes les tables du schéma public'
);

-- -----------------------------------------------------------------------------
-- Anonyme : aucune donnée
-- -----------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is_empty($$ select id from public.organizations $$, 'Anonyme : aucune organisation visible');
select is_empty($$ select id from public.suppliers $$, 'Anonyme : aucun fournisseur visible');

-- -----------------------------------------------------------------------------
-- Utilisateur de l'organisation B
-- -----------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "souss@demo.ma", "aal": "aal1"}';

select results_eq(
  $$ select id from public.organizations $$,
  $$ values ('b0000000-0000-4000-8000-000000000002'::uuid) $$,
  'B ne voit que sa propre organisation'
);
select is((select count(*) from public.suppliers)::int, 1, 'B ne voit que son fournisseur');
select is((select count(*) from public.invoices)::int, 1, 'B ne voit que sa facture');
select is_empty($$ select id from public.payments $$, 'B ne voit aucun paiement de A');
select is_empty($$ select id from public.bank_accounts where organization_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'B ne voit aucun compte bancaire de A');
select is_empty($$ select id from public.statement_lines $$, 'B ne voit aucune ligne de relevé de A');
select is_empty($$ select id from public.memberships where organization_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'B ne voit pas les membres de A');
select is_empty($$ select id from public.profiles where id = 'a0000000-0000-4000-8000-000000000001' $$,
  'B ne voit pas le profil d''un utilisateur de A');
select is_empty($$ select id from public.audit_log where organization_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'B ne voit pas le journal d''audit de A');

-- Écritures vers l'organisation A
select throws_ok(
  $$ insert into public.suppliers (organization_id, name) values ('b0000000-0000-4000-8000-000000000001', 'Intrus') $$,
  '42501', null,
  'B ne peut pas créer de fournisseur dans A'
);

update public.suppliers set name = 'Piraté' where id = 'e0000000-0000-4000-8000-000000000001';
delete from public.invoices where id = 'f0000000-0000-4000-8000-000000000005';

select throws_ok(
  $$ update public.suppliers set organization_id = 'b0000000-0000-4000-8000-000000000001'
     where id = 'e0000000-0000-4000-8000-000000000006' $$,
  '42501', null,
  'B ne peut pas déplacer une ligne vers A'
);

select throws_ok(
  $$ insert into public.memberships (organization_id, user_id, role)
     values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'admin') $$,
  '42501', null,
  'B ne peut pas s''ajouter comme membre de A'
);

-- Clé composite : impossible de référencer le fournisseur de A depuis B, même par son identifiant
select throws_ok(
  $$ insert into public.invoices (organization_id, supplier_id, number, issue_date, amount_incl_tax)
     values ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'X-1', '2026-10-01', 100) $$,
  '23503', null,
  'B ne peut pas rattacher une facture au fournisseur de A'
);

-- Stockage : objets préfixés par l'organisation A
reset role;
insert into storage.objects (bucket_id, name, owner)
values ('factures', 'b0000000-0000-4000-8000-000000000001/facture-test.pdf', 'a0000000-0000-4000-8000-000000000001');
set local role authenticated;

select is_empty(
  $$ select id from storage.objects where name like 'b0000000-0000-4000-8000-000000000001/%' $$,
  'B ne voit pas les fichiers de A'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('factures', 'b0000000-0000-4000-8000-000000000001/intrus.pdf') $$,
  '42501', null,
  'B ne peut pas déposer de fichier dans le dossier de A'
);

-- Vérification, côté propriétaire de la base, que rien n'a été modifié dans A
reset role;
select is((select name from public.suppliers where id = 'e0000000-0000-4000-8000-000000000001'),
  'Sotrama Matériaux SARL', 'La modification de B sur A a été sans effet');
select isnt_empty($$ select id from public.invoices where id = 'f0000000-0000-4000-8000-000000000005' $$,
  'La suppression de B sur A a été sans effet');

-- -----------------------------------------------------------------------------
-- Rôles au sein de l'organisation A
-- -----------------------------------------------------------------------------

-- Comptable : lecture seule
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';

select is((select count(*) from public.suppliers)::int, 5, 'Comptable : voit les 5 fournisseurs de A');
select isnt_empty($$ select id from public.audit_log $$, 'Comptable : peut lire le journal d''audit');
select throws_ok(
  $$ insert into public.suppliers (organization_id, name) values ('b0000000-0000-4000-8000-000000000001', 'Nouveau') $$,
  '42501', null,
  'Comptable : ne peut pas créer de fournisseur'
);

-- Préparateur : saisit fournisseurs et factures, pas les comptes bancaires
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

select lives_ok(
  $$ insert into public.suppliers (organization_id, name) values ('b0000000-0000-4000-8000-000000000001', 'Nouveau fournisseur') $$,
  'Préparateur : peut créer un fournisseur'
);
select throws_ok(
  $$ insert into public.bank_accounts (organization_id, bank_id, label)
     select 'b0000000-0000-4000-8000-000000000001', id, 'Compte pirate' from public.banks limit 1 $$,
  '42501', null,
  'Préparateur : ne peut pas créer de compte bancaire'
);
select is_empty($$ select id from public.audit_log $$, 'Préparateur : ne lit pas le journal d''audit');

-- Un paiement émis ne peut pas être supprimé (seulement annulé)
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated", "email": "admin@demo.ma", "aal": "aal1"}';
delete from public.payments where id = '10000000-0000-4000-8000-000000000004';
select isnt_empty($$ select id from public.payments where id = '10000000-0000-4000-8000-000000000004' $$,
  'Un paiement émis n''est jamais supprimé');

-- Journal d'audit en écriture interdite
select throws_ok(
  $$ insert into public.audit_log (organization_id, action) values ('b0000000-0000-4000-8000-000000000001', 'faux') $$,
  '42501', null,
  'Le journal d''audit n''est pas modifiable depuis l''API'
);

-- Le dernier administrateur ne peut pas être retiré
select throws_ok(
  $$ delete from public.memberships where user_id = 'a0000000-0000-4000-8000-000000000001'
       and organization_id = 'b0000000-0000-4000-8000-000000000001' $$,
  'P0001', null,
  'Le dernier administrateur ne peut pas être retiré'
);

-- Création d'une organisation : l'utilisateur en devient administrateur
select lives_ok($$ select public.create_organization('Nouvelle Société', 'Rabat') $$,
  'Un utilisateur peut créer une organisation');
select is(
  (select m.role::text from public.memberships m
     join public.organizations o on o.id = m.organization_id
    where o.name = 'Nouvelle Société' and m.user_id = 'a0000000-0000-4000-8000-000000000001'),
  'admin', 'Le créateur est administrateur de la nouvelle organisation');

-- -----------------------------------------------------------------------------
-- Double authentification : un facteur vérifié impose une session aal2
-- -----------------------------------------------------------------------------
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002', 'Téléphone', 'totp', 'verified', now(), now(), 'secret');
set local role authenticated;

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';
select is_empty($$ select id from public.suppliers $$, 'MFA activée + session aal1 : aucune donnée');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal2"}';
select isnt_empty($$ select id from public.suppliers $$, 'MFA activée + session aal2 : données accessibles');

select * from finish();

rollback;
