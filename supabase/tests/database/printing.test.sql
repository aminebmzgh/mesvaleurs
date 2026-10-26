-- Suivi des impressions de lots.
begin;

select plan(5);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

select public.issue_payments(
  'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000003', '', '2026-10-27', 'Casablanca', '[{"amount": 100}]'
) as batch_id \gset

select is(public.record_batch_print(:'batch_id'), 1, 'Première impression');
select is(public.record_batch_print(:'batch_id'), 2, 'Réimpression');
select isnt((select printed_at from public.print_batches where id = :'batch_id'), null, 'Date de première impression');

reset role;
select results_eq(
  format($$ select action from public.audit_log where record_id = %L and action in ('print', 'reprint') order by id $$, :'batch_id'),
  $$ values ('print'), ('reprint') $$,
  'Impression et réimpression journalisées');
set local role authenticated;

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "souss@demo.ma", "aal": "aal1"}';
select throws_ok(format('select public.record_batch_print(%L)', :'batch_id'), 'P0002', null,
  'Une autre organisation ne peut pas imprimer ce lot');

select * from finish();
rollback;
