-- Accusés de réception (seed : chèque 1003 émis pour ATL, 1005 émis pour Centrale Agro, 1000 débité).
begin;

select plan(14);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

select throws_ok($$ select public.record_payment_receipt(array['10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000006']::uuid[],
  '2026-10-20', 'Karim Alami', null, 'b0000000-0000-4000-8000-000000000001/accuses/a.png') $$,
  '22023', null, 'Les valeurs d''un accusé vont à un seul fournisseur');
select throws_ok($$ select public.record_payment_receipt(array['10000000-0000-4000-8000-000000000001']::uuid[],
  '2026-10-20', 'Karim Alami', null, 'b0000000-0000-4000-8000-000000000001/accuses/a.png') $$,
  'P0001', null, 'Un chèque débité ne se remet plus');
select throws_ok($$ select public.record_payment_receipt(array['10000000-0000-4000-8000-000000000004']::uuid[],
  '2026-10-10', 'Karim Alami', null, 'b0000000-0000-4000-8000-000000000001/accuses/a.png') $$,
  '22023', null, 'Remise antérieure à l''émission refusée');
select throws_ok($$ select public.record_payment_receipt(array['10000000-0000-4000-8000-000000000004']::uuid[],
  '2026-10-20', 'Karim Alami', null, 'b0000000-0000-4000-8000-000000000002/accuses/a.png') $$,
  '22023', null, 'Signature rangée chez une autre entreprise refusée');

select lives_ok($$ select public.record_payment_receipt(array['10000000-0000-4000-8000-000000000004']::uuid[],
  '2026-10-20', '  Karim Alami ', 'BE123456', 'b0000000-0000-4000-8000-000000000001/accuses/sig-1.png',
  'b0000000-0000-4000-8000-000000000001/accuses/photo-1.jpg') $$,
  'Le préparateur enregistre la remise signée du chèque 1003');
select is(
  (select row(reference, delivered_on, signer_name, signer_id_number, supplier_id)::text from public.payment_receipts),
  row('AR-2026-0001', '2026-10-20'::date, 'Karim Alami', 'BE123456', 'e0000000-0000-4000-8000-000000000003'::uuid)::text,
  'Accusé numéroté, signataire et date de remise conservés');
select is((select row(status, delivered_at)::text from public.payments where id = '10000000-0000-4000-8000-000000000004'),
  row('delivered', '2026-10-20'::date)::text, 'Le chèque passe en remis à la date signée');
select throws_ok($$ select public.record_payment_receipt(array['10000000-0000-4000-8000-000000000004']::uuid[],
  '2026-10-21', 'Autre', null, 'b0000000-0000-4000-8000-000000000001/accuses/sig-2.png') $$,
  'P0001', null, 'Une valeur ne reçoit qu''un accusé');

select lives_ok($$ select public.record_payment_receipt(array['10000000-0000-4000-8000-000000000006']::uuid[],
  '2026-10-21', 'Livreur CAD', null, 'b0000000-0000-4000-8000-000000000001/accuses/sig-3.png') $$,
  'Deuxième remise de l''année');
select is((select max(reference) from public.payment_receipts), 'AR-2026-0002', 'Numérotation à la suite');

select lives_ok($$ select public.mark_receipt_emailed((select id from public.payment_receipts where reference = 'AR-2026-0001'), 'factures@atl.ma') $$,
  'Envoi du reçu par e-mail enregistré');
select throws_ok($$ update public.payment_receipts set signer_name = 'Falsifié' $$, '42501', null,
  'Un accusé signé ne se modifie pas directement');

-- Le comptable consulte, sans enregistrer de remise
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';
select is((select count(*)::int from public.payment_receipt_items), 2, 'Le comptable voit les accusés de son entreprise');

-- Autre entreprise : rien de visible
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "souss@demo.ma", "aal": "aal1"}';
select is((select count(*)::int from public.payment_receipts), 0, 'Accusés invisibles des autres entreprises');

select * from finish();
rollback;
