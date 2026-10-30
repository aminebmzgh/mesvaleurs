-- Verrouillage après échecs de connexion : compteur réservé au serveur (service_role).
begin;

select plan(10);

select set_config('test.k1', repeat('1', 64), true);
select set_config('test.k2', repeat('2', 64), true);

set local role service_role;

select is(public.record_login_failure(current_setting('test.k1'), 3, '15 minutes', '15 minutes'), null,
  '1er échec : pas encore verrouillé');
select is(public.record_login_failure(current_setting('test.k1'), 3, '15 minutes', '15 minutes'), null,
  '2e échec : pas encore verrouillé');
select ok(public.record_login_failure(current_setting('test.k1'), 3, '15 minutes', '15 minutes') > now() + interval '14 minutes',
  'Seuil atteint : verrouillé pour la durée prévue');
select ok(public.login_locked_until(array[current_setting('test.k2'), current_setting('test.k1')]) is not null,
  'Verrouillage visible pour l''une des clés');
select is(public.login_locked_until(array[current_setting('test.k2')]), null, 'Autres clés non verrouillées');

-- Verrouillage échu : le compteur repart de zéro
update public.login_lockouts set locked_until = now() - interval '1 second' where key = current_setting('test.k1');
select is(public.record_login_failure(current_setting('test.k1'), 3, '15 minutes', '15 minutes'), null,
  'Après le verrouillage, nouvel essai compté depuis zéro');
select is((select failures from public.login_lockouts where key = current_setting('test.k1')), 1, 'Compteur remis à 1');

select lives_ok($$ select public.clear_login_failures(current_setting('test.k1')) $$, 'Connexion réussie : compteur effacé');

reset role;
set local role anon;
select throws_ok($$ select public.record_login_failure(repeat('3', 64), 1, '1 minute', '1 day') $$,
  '42501', null, 'Un visiteur ne peut pas verrouiller un compte');

set local role authenticated;
select throws_ok($$ select * from public.login_lockouts $$, '42501', null, 'Compteurs invisibles depuis l''application');

select * from finish();
rollback;
