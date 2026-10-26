-- Règles des comptes bancaires et des chéquiers (données du seed : organisation Atlas).
begin;

select plan(10);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated", "email": "admin@demo.ma", "aal": "aal1"}';

-- Le solde courant d'un nouveau compte part du solde d'ouverture
insert into public.bank_accounts (id, organization_id, bank_id, label, rib, opening_balance)
select 'c0000000-0000-4000-8000-0000000000aa', 'b0000000-0000-4000-8000-000000000001', id, 'Compte test',
  '150500211501441691001583', 12500.50
from public.banks where name = 'CIH Bank';

select is(
  (select current_balance from public.bank_accounts where id = 'c0000000-0000-4000-8000-0000000000aa'),
  12500.50::numeric, 'Le solde courant est initialisé au solde d''ouverture');

select throws_ok(
  $$ insert into public.bank_accounts (organization_id, bank_id, label, rib)
     select 'b0000000-0000-4000-8000-000000000001', id, 'Doublon', '150500211501441691001583'
     from public.banks limit 1 $$,
  '23505', null, 'Un RIB ne peut être enregistré qu''une fois par organisation');

-- Corriger le solde d'ouverture décale le solde courant du même écart
update public.bank_accounts set opening_balance = 10000 where id = 'c0000000-0000-4000-8000-0000000000aa';
select is((select current_balance from public.bank_accounts where id = 'c0000000-0000-4000-8000-0000000000aa'),
  10000.00::numeric, 'Corriger le solde d''ouverture décale le solde courant');

-- Le prochain numéro est initialisé au premier
insert into public.checkbooks (id, organization_id, bank_account_id, type, first_number, last_number)
values ('d0000000-0000-4000-8000-0000000000aa', 'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-0000000000aa', 'check', 2000, 2024);

select is((select next_number from public.checkbooks where id = 'd0000000-0000-4000-8000-0000000000aa'),
  2000::bigint, 'Un nouveau carnet commence à son premier numéro');

-- Chevauchement de plages
select throws_ok(
  $$ insert into public.checkbooks (organization_id, bank_account_id, type, first_number, last_number)
     values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000aa', 'check', 2020, 2049) $$,
  '23P01', null, 'Deux chéquiers d''un même compte ne peuvent pas partager de numéros');

select lives_ok(
  $$ insert into public.checkbooks (organization_id, bank_account_id, type, first_number, last_number)
     values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000aa', 'check', 2025, 2049) $$,
  'Un chéquier contigu est accepté');

select lives_ok(
  $$ insert into public.checkbooks (organization_id, bank_account_id, type, first_number, last_number)
     values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000aa', 'lcn', 2000, 2024) $$,
  'Un carnet de LCN peut reprendre les numéros d''un chéquier');

-- Plage figée après utilisation (le chéquier du seed a déjà des chèques émis)
select throws_ok(
  $$ update public.checkbooks set last_number = 1099 where id = 'd0000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'La plage d''un carnet déjà utilisé ne peut plus être modifiée');

select throws_ok(
  $$ update public.checkbooks set next_number = 1003 where id = 'd0000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Le prochain numéro ne peut pas reculer');

-- Synthèse : 50 formules, prochaine 1006 → 44 restantes, 1 annulée
select results_eq(
  $$ select total_count, remaining_count, cancelled_count from public.checkbook_summaries
     where id = 'd0000000-0000-4000-8000-000000000001' $$,
  $$ values (50, 44, 1) $$,
  'La synthèse compte les formules totales, restantes et annulées');

select * from finish();
rollback;
