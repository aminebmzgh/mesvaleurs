-- Chèques de garantie (données du seed : chéquier …d01, carnet de LCN …d02).
begin;

select plan(8);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

select lives_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
    null, '2026-10-28', 'Casablanca', '[{"amount": 50000}]'::jsonb, '[]'::jsonb,
    '{"purpose": "Caution marché 12/2026", "return_due": "2027-01-31"}'::jsonb)
$$, 'Émission d''un chèque de garantie depuis le chéquier');

select is(
  (select row(type, status, guarantee_purpose, guarantee_return_due)::text from public.payments where guarantee_purpose = 'Caution marché 12/2026'),
  row('guarantee_check', 'issued', 'Caution marché 12/2026', '2027-01-31')::text,
  'Chèque de garantie numéroté, émis, avec objet et restitution prévue'
);

select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003',
    null, '2026-10-28', 'Casablanca', '[{"amount": 100}]'::jsonb,
    '[{"index": 0, "invoice_id": "f0000000-0000-4000-8000-000000000005", "amount": 100}]'::jsonb,
    '{"purpose": "x", "return_due": "2027-01-31"}'::jsonb)
$$, '22023', null, 'Un chèque de garantie ne règle aucune facture');
select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002',
    null, '2026-10-28', 'Casablanca', '[{"amount": 100, "due_date": "2026-12-01"}]'::jsonb, '[]'::jsonb,
    '{"purpose": "x", "return_due": "2027-01-31"}'::jsonb)
$$, 'P0001', null, 'Pas de garantie depuis un carnet de LCN');
select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
    null, '2026-10-28', 'Casablanca', '[{"amount": 100}]'::jsonb, '[]'::jsonb, '{"purpose": "x"}'::jsonb)
$$, '22023', null, 'La restitution prévue est obligatoire');

-- Restitution : sort de la circulation, motif renseigné
select lives_ok($$
  select public.close_guarantee((select id from public.payments where guarantee_purpose = 'Caution marché 12/2026'), 'returned', '2026-10-28')
$$, 'Restitution enregistrée');
select is(
  (select row(status, guarantee_outcome, cancellation_reason)::text from public.payments where guarantee_purpose = 'Caution marché 12/2026'),
  row('cancelled', 'returned', 'Chèque de garantie restitué')::text,
  'Chèque restitué : clos avec son issue'
);
select throws_ok($$
  select public.close_guarantee('10000000-0000-4000-8000-000000000004', 'destroyed', '2026-10-28')
$$, 'P0001', null, 'Un chèque ordinaire ne se clôt pas comme une garantie');

select * from finish();
rollback;
