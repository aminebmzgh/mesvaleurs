-- Virements fournisseurs (données du seed).
--   ATL-7845 (Atlas Transport) : 6 200,00 TTC, non payée
--   BP-10293 (Bureau Pro)      : 2 340,00 TTC, non payée
begin;

select plan(9);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

-- Virement déjà débité : la facture est réglée et encaissée
select lives_ok($$
  select public.record_transfer(
    'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000003', 6200.00, '2026-10-20', 'VIR-TEST-1', true,
    '[{"invoice_id": "f0000000-0000-4000-8000-000000000005", "amount": 6200.00}]'::jsonb)
$$, 'Le préparateur saisit un virement débité');

select is(
  (select row(type, status, number, checkbook_id, debited_at, payee_name)::text from public.payments where reference = 'VIR-TEST-1'),
  row('transfer', 'paid', null, null, '2026-10-20', 'ATLAS TRANSPORT ET LOGISTIQUE')::text,
  'Virement : sans numéro ni carnet, débité à sa date, bénéficiaire du fournisseur'
);
select is(
  (select row(amount_paid, amount_cashed, status)::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000005'),
  row(6200.00, 6200.00, 'paid')::text,
  'La facture est réglée et encaissée'
);

-- Virement en attente : réglé mais pas encaissé
select public.record_transfer(
  'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000005', 2340.00, '2026-10-25', 'VIR-TEST-2', false,
  '[{"invoice_id": "f0000000-0000-4000-8000-000000000007", "amount": 2340.00}]'::jsonb);
select is(
  (select row(status, debited_at)::text from public.payments where reference = 'VIR-TEST-2'),
  row('issued', null)::text,
  'Virement en attente : statut émis, sans date de débit'
);
select is(
  (select row(amount_paid, amount_cashed)::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000007'),
  row(2340.00, 0.00)::text,
  'Facture réglée, pas encore encaissée'
);

-- Contrôles
select throws_ok($$
  select public.record_transfer(
    'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000004', 1000.00, '2026-10-20', 'VIR-TEST-3', true,
    '[{"invoice_id": "f0000000-0000-4000-8000-000000000006", "amount": 900.00}]'::jsonb)
$$, '22023', null, 'Montant affecté différent du virement : refusé');
select throws_ok($$
  select public.record_transfer(
    'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000004', 1000.00, '2026-10-20', '  ', true, '[]'::jsonb)
$$, '22023', null, 'Référence obligatoire');
select throws_ok($$
  update public.payments set number = 123 where reference = 'VIR-TEST-2'
$$, 'P0001', null, 'Un virement saisi ne prend pas de numéro (montant, numéro figés)');

-- Comptable : lecture seule
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';
select throws_ok($$
  select public.record_transfer(
    'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000004', 1000.00, '2026-10-20', 'VIR-TEST-4', true, '[]'::jsonb)
$$, '42501', null, 'Le comptable ne saisit pas de virement');

select * from finish();
rollback;
