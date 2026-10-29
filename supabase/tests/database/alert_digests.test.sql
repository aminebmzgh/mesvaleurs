-- Alertes par e-mail : préférence de chaque membre, envois réservés à la tâche planifiée.
begin;

select plan(7);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

select is(
  (select email_alerts from public.memberships where user_id = 'a0000000-0000-4000-8000-000000000003'),
  true, 'Récapitulatif activé par défaut');

select lives_ok($$ select public.set_email_alerts('b0000000-0000-4000-8000-000000000001', false) $$,
  'Un membre désactive son récapitulatif');
select is(
  (select email_alerts from public.memberships where user_id = 'a0000000-0000-4000-8000-000000000003'),
  false, 'Préférence enregistrée');
select is(
  (select email_alerts from public.memberships where user_id = 'a0000000-0000-4000-8000-000000000002'),
  true, 'Sans effet sur les autres membres');

select throws_ok($$ select public.set_email_alerts('b0000000-0000-4000-8000-000000000002', false) $$,
  '42501', null, 'Refusé pour une entreprise dont on n''est pas membre');

select throws_ok($$ update public.memberships set email_alerts = true where user_id = 'a0000000-0000-4000-8000-000000000003' $$,
  '42501', null, 'Pas de modification directe de la préférence');

select throws_ok($$ insert into public.alert_digests (organization_id, digest_date) values ('b0000000-0000-4000-8000-000000000001', '2026-10-29') $$,
  '42501', null, 'Les envois ne s''écrivent pas depuis l''application');

select * from finish();
rollback;
