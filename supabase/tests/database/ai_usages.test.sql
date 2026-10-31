-- Consommation de l'IA : quota mensuel réservé par le serveur (service_role), consultation par les membres.
begin;

select plan(9);

set local role service_role;

select ok(public.reserve_ai_usage('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'invoice_reading', 2) is not null,
  '1er appel du mois réservé');
select ok(public.reserve_ai_usage('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'invoice_reading', 2) is not null,
  '2e appel réservé');
select is(public.reserve_ai_usage('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'invoice_reading', 2), null,
  'Quota atteint : appel refusé');
select is((select count(*)::int from public.ai_usages where organization_id = 'b0000000-0000-4000-8000-000000000001'), 2,
  'L''appel refusé n''est pas inscrit');

-- Appels du mois précédent : hors quota
update public.ai_usages set created_at = date_trunc('month', now()) - interval '1 day'
where organization_id = 'b0000000-0000-4000-8000-000000000001';
select ok(public.reserve_ai_usage('b0000000-0000-4000-8000-000000000001', null, 'invoice_reading', 2) is not null,
  'Nouveau mois : le quota repart de zéro');

select ok(public.reserve_ai_usage('b0000000-0000-4000-8000-000000000002', null, 'invoice_reading', 1) is not null,
  'Quota propre à chaque entreprise');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';

select is((select count(*)::int from public.ai_usages), 3, 'Un membre voit la consommation de son entreprise seulement');
select throws_ok($$ select public.reserve_ai_usage('b0000000-0000-4000-8000-000000000001', null, 'invoice_reading', 1000) $$,
  '42501', null, 'L''application ne réserve pas d''appel directement');
select throws_ok($$ insert into public.ai_usages (organization_id, feature) values ('b0000000-0000-4000-8000-000000000001', 'invoice_reading') $$,
  '42501', null, 'La consommation ne s''écrit pas directement');

select * from finish();
rollback;
