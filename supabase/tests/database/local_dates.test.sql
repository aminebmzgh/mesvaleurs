-- Dates « pas dans le futur » : la date du jour locale est acceptée même quand elle
-- précède d'un jour la date UTC du serveur (au Maroc, entre minuit et 1 h).
begin;

select plan(6);

-- Date la plus avancée du globe (UTC+14) : « aujourd'hui » quel que soit le fuseau de l'utilisateur
create temporary table horizon as select (now() at time zone 'Etc/GMT-14')::date as today;
grant select on horizon to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';

select throws_ok($$ select public.reject_payment('10000000-0000-4000-8000-000000000004', 'insufficient_funds', '', (select today + 1 from horizon)) $$,
  '22023', null, 'Un rejet daté du lendemain est refusé');
select lives_ok($$ select public.reject_payment('10000000-0000-4000-8000-000000000004', 'insufficient_funds', '', (select today from horizon)) $$,
  'Un rejet daté du jour local est accepté, même en avance sur la date UTC');
select lives_ok($$ select public.regularize_payment('10000000-0000-4000-8000-000000000004', 'other', (select today from horizon), null, 'Espèces') $$,
  'Une régularisation datée du jour local est acceptée');

select throws_ok($$ select public.postpone_lcn('10000000-0000-4000-8000-000000000008', '2027-01-18', 'Report', (select today + 1 from horizon)) $$,
  '22023', null, 'Un accord du fournisseur daté du lendemain est refusé');
select lives_ok($$ select public.postpone_lcn('10000000-0000-4000-8000-000000000008', '2027-01-18', 'Report', (select today from horizon)) $$,
  'Un accord du fournisseur daté du jour local est accepté');

select throws_ok($$ select public.stop_payment('10000000-0000-4000-8000-000000000006', 'lost', (select today + 1 from horizon)) $$,
  '22023', null, 'Une opposition datée du lendemain est refusée');

select * from finish();
rollback;
