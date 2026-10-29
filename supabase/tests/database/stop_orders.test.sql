-- Oppositions (seed : chéquier 1000–1049, prochain n° 1006 ; chèque 1003 émis, réglant ATL-7781).
begin;

select plan(16);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

-- Opposition sur un chèque émis
select lives_ok($$ select public.stop_payment('10000000-0000-4000-8000-000000000004', 'lost', '2026-10-20', 'PV 1234/2026', null) $$,
  'Le préparateur fait opposition sur un chèque perdu');
select is((select status::text from public.payments where id = '10000000-0000-4000-8000-000000000004'), 'stopped',
  'Le chèque passe en opposition');
select is((select row(amount_paid, status)::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000004'),
  row(0.00::numeric(14, 2), 'unpaid')::text, 'La facture réglée par le chèque redevient à payer');
select is(
  (select row(first_number, last_number, reason, police_report)::text from public.stop_orders where payment_id = '10000000-0000-4000-8000-000000000004'),
  row(1003, 1003, 'lost', 'PV 1234/2026')::text, 'L''opposition est enregistrée avec le numéro et le récépissé');

select throws_ok($$ select public.stop_payment('10000000-0000-4000-8000-000000000008', 'fraudulent_use', '2026-10-20') $$,
  '22023', null, 'L''utilisation frauduleuse n''est pas un motif d''opposition sur une LCN');
select throws_ok($$ select public.stop_payment('10000000-0000-4000-8000-000000000001', 'stolen', '2026-10-20') $$,
  'P0001', null, 'Un chèque débité ne peut plus être mis en opposition');

-- Opposition sur des formules vierges
select lives_ok($$ select public.stop_blank_forms('d0000000-0000-4000-8000-000000000001', 1006, 1007, 'stolen', '2026-10-25') $$,
  'Opposition sur les deux prochaines formules vierges');
select is((select next_number from public.checkbooks where id = 'd0000000-0000-4000-8000-000000000001'), 1008::bigint,
  'Le prochain numéro saute les formules en opposition');
select lives_ok($$ select public.stop_blank_forms('d0000000-0000-4000-8000-000000000001', 1010, 1010, 'lost', '2026-10-25') $$,
  'Opposition sur une formule au milieu du chéquier');
select throws_ok($$ select public.stop_blank_forms('d0000000-0000-4000-8000-000000000001', 1009, 1011, 'lost', '2026-10-25') $$,
  'P0001', null, 'Des formules déjà en opposition ne le sont pas deux fois');
select throws_ok($$ select public.stop_blank_forms('d0000000-0000-4000-8000-000000000001', 1002, 1002, 'lost', '2026-10-25') $$,
  '22023', null, 'Une formule déjà utilisée relève de l''opposition sur paiement');
select throws_ok($$ select public.stop_blank_forms('d0000000-0000-4000-8000-000000000001', 1040, 1041, 'holder_insolvency', '2026-10-25') $$,
  '22023', null, 'Une formule vierge ne s''oppose que pour perte ou vol');

-- Émission : les numéros sautent la formule 1010
select public.issue_payments(
  'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000005', '', '2026-10-28', 'Casablanca',
  '[{"amount": 100}, {"amount": 100}, {"amount": 100}]'
);
select results_eq(
  $$ select number from public.payments where supplier_id = 'e0000000-0000-4000-8000-000000000005' and issue_date = '2026-10-28' order by number $$,
  $$ values (1008::bigint), (1009::bigint), (1011::bigint) $$,
  'Les formules en opposition ne sont jamais attribuées');
select is(
  (select row(next_number, remaining_count, stopped_blank_count)::text from public.checkbook_summaries where id = 'd0000000-0000-4000-8000-000000000001'),
  row(1012, 38, 3)::text, 'Synthèse du carnet : formules restantes et formules vierges en opposition');

select throws_ok($$ insert into public.stop_orders (organization_id, bank_account_id, checkbook_id, first_number, last_number, reason, occurred_on)
  values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1030, 1030, 'lost', '2026-10-25') $$,
  '42501', null, 'Les oppositions ne s''écrivent pas directement');

-- Le comptable consulte mais ne fait pas opposition
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';
select throws_ok($$ select public.stop_payment('10000000-0000-4000-8000-000000000006', 'lost', '2026-10-20') $$,
  'P0002', null, 'Le comptable ne peut pas faire opposition');

select * from finish();
rollback;
