-- Résumé mensuel : préférence de chaque membre, envois écrits par la tâche seulement.
begin;

select plan(6);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';

select lives_ok($$ select public.set_email_monthly_summary('b0000000-0000-4000-8000-000000000001', false) $$,
  'Le comptable désactive son résumé mensuel');
select is((select email_monthly_summary from public.memberships
  where organization_id = 'b0000000-0000-4000-8000-000000000001' and user_id = 'a0000000-0000-4000-8000-000000000004'), false,
  'Préférence enregistrée pour lui seul');
select throws_ok($$ select public.set_email_monthly_summary('b0000000-0000-4000-8000-000000000002', true) $$,
  '42501', null, 'Pas de préférence dans une entreprise dont on n''est pas membre');
select throws_ok($$ insert into public.monthly_summaries (organization_id, month) values ('b0000000-0000-4000-8000-000000000001', '2026-10-01') $$,
  '42501', null, 'Les envois ne s''écrivent pas depuis l''application');

reset role;
set local role service_role;
select lives_ok($$ insert into public.monthly_summaries (organization_id, month) values ('b0000000-0000-4000-8000-000000000001', '2026-10-01') $$,
  'La tâche planifiée réserve l''envoi du mois');
select ok(public.reserve_ai_usage('b0000000-0000-4000-8000-000000000001', null, 'monthly_summary', 100) is not null,
  'Le paragraphe de l''assistant compte dans le quota d''IA');

select * from finish();
rollback;
