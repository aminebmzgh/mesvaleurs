-- Report d'échéance des LCN (seed : LCN 5000101 …008, remise, échéance 18/11/2026).
begin;

select plan(7);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';

select lives_ok($$ select public.postpone_lcn('10000000-0000-4000-8000-000000000008', '2026-12-18', 'Décalage de trésorerie', '2026-10-27') $$,
  'Report de l''échéance avec l''accord du fournisseur');
select is((select due_date from public.payments where id = '10000000-0000-4000-8000-000000000008'), '2026-12-18'::date,
  'L''échéance de la LCN est mise à jour');
select is(
  (select row(previous_due_date, new_due_date, reason)::text from public.lcn_postponements where payment_id = '10000000-0000-4000-8000-000000000008'),
  row('2026-11-18', '2026-12-18', 'Décalage de trésorerie')::text,
  'Le report est historisé (ancienne et nouvelle échéance, motif)'
);

select throws_ok($$ select public.postpone_lcn('10000000-0000-4000-8000-000000000008', '2026-12-01', 'Avancer', '2026-10-27') $$,
  '22023', null, 'Une nouvelle échéance antérieure est refusée');
select throws_ok($$ select public.postpone_lcn('10000000-0000-4000-8000-000000000007', '2026-12-30', 'LCN débitée', '2026-10-27') $$,
  'P0001', null, 'Une LCN déjà débitée ne se reporte pas');
select throws_ok($$ select public.postpone_lcn('10000000-0000-4000-8000-000000000004', '2026-12-30', 'Chèque', '2026-10-27') $$,
  'P0001', null, 'Un chèque ne se reporte pas');
select throws_ok($$ insert into public.lcn_postponements (organization_id, payment_id, previous_due_date, new_due_date, reason, supplier_agreed_at)
  values ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', '2026-12-18', '2027-01-18', 'Direct', '2026-10-27') $$,
  '42501', null, 'L''historique ne s''écrit pas directement');

select * from finish();
rollback;
