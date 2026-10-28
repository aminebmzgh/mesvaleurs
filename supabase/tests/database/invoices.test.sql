-- Factures : date limite légale, montants réglé / encaissé et statut (données du seed).
begin;

select plan(16);

-- Date limite légale ---------------------------------------------------------

select is((select legal_due_date from public.invoices where id = 'f0000000-0000-4000-8000-000000000001'),
  '2026-10-04'::date, 'Sotrama (60 j convenus) : 05/08 + 60 j = 04/10');
select is((select legal_due_date from public.invoices where id = 'f0000000-0000-4000-8000-000000000003'),
  '2026-10-18'::date, 'Maghreb Emballages (90 j convenus) : 20/07 + 90 j = 18/10');

-- Totaux recalculés par la base à partir des paiements du seed ---------------

select results_eq(
  $$ select amount_paid, amount_cashed, status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000003' $$,
  $$ values (120000.00::numeric(14, 2), 40000.00::numeric(14, 2), 'paid') $$,
  'ME/26/1187 : réglée par 3 LCN, une seule débitée');
select results_eq(
  $$ select amount_paid, status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000006' $$,
  $$ values (12000.00::numeric(14, 2), 'partially_paid') $$,
  'CAD-2026-332 : le chèque annulé ne compte pas');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';

-- Délai convenu absent → défaut légal ; délai excessif → plafond légal
insert into public.suppliers (id, organization_id, name, payment_terms_days) values
  ('e0000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-000000000001', 'Sans délai', null),
  ('e0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-000000000001', 'Délai excessif', 200);
insert into public.invoices (id, organization_id, supplier_id, number, issue_date, amount_incl_tax) values
  ('f0000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000a1', 'T-1', '2026-01-10', 1000),
  ('f0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-0000000000a2', 'T-2', '2026-01-10', 1000);

select is((select legal_due_date from public.invoices where id = 'f0000000-0000-4000-8000-0000000000a1'),
  '2026-03-11'::date, 'Sans délai convenu : délai légal par défaut (60 j)');
select is((select legal_due_date from public.invoices where id = 'f0000000-0000-4000-8000-0000000000a2'),
  '2026-05-10'::date, 'Délai convenu de 200 j plafonné au maximum légal (120 j)');

update public.suppliers set payment_terms_days = 30 where id = 'e0000000-0000-4000-8000-0000000000a1';
select is((select legal_due_date from public.invoices where id = 'f0000000-0000-4000-8000-0000000000a1'),
  '2026-02-09'::date, 'Le nouveau délai du fournisseur s''applique à ses factures sans délai propre');

-- Le statut suit les paiements --------------------------------------------

update public.payments set status = 'paid', debited_at = '2026-10-20' where id = '10000000-0000-4000-8000-000000000003';
select results_eq(
  $$ select amount_paid, amount_cashed, status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000002' $$,
  $$ values (15600.00::numeric(14, 2), 15600.00::numeric(14, 2), 'paid') $$,
  'Chèque débité : la facture devient encaissée');

update public.payments set status = 'cancelled', cancellation_reason = 'Test' where id = '10000000-0000-4000-8000-000000000006';
select results_eq(
  $$ select amount_paid, status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000006' $$,
  $$ values (0.00::numeric(14, 2), 'unpaid') $$,
  'Chèque annulé : la facture redevient non payée');

-- Chèque de garantie rattaché à ATL-7845 (non payée) : il ne la règle pas
insert into public.payments (id, organization_id, type, status, bank_account_id, checkbook_id, number,
  supplier_id, payee_name, amount, guarantee_return_due)
values ('10000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-000000000001', 'guarantee_check', 'issued',
  'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1040,
  'e0000000-0000-4000-8000-000000000003', 'ATLAS TRANSPORT ET LOGISTIQUE', 6200, '2027-01-31');
insert into public.payment_allocations (organization_id, payment_id, invoice_id, amount)
values ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-0000000000a1',
  'f0000000-0000-4000-8000-000000000005', 6200);
select is((select amount_paid from public.invoices where id = 'f0000000-0000-4000-8000-000000000005'),
  0.00::numeric(14, 2), 'Un chèque de garantie ne règle pas la facture');

-- Statut : seule la contestation est manuelle --------------------------------

update public.invoices set status = 'paid' where id = 'f0000000-0000-4000-8000-000000000005';
select is((select status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000005'),
  'unpaid', 'Impossible de marquer « payée » une facture sans paiement');

update public.invoices set status = 'disputed' where id = 'f0000000-0000-4000-8000-000000000001';
select is((select status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000001'),
  'disputed', 'Une facture peut être contestée');

update public.invoices set status = 'unpaid' where id = 'f0000000-0000-4000-8000-000000000001';
select is((select status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000001'),
  'paid', 'Contestation levée : le statut est recalculé à partir des paiements');

update public.invoices set amount_incl_tax = 60000 where id = 'f0000000-0000-4000-8000-000000000001';
select is((select status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000001'),
  'partially_paid', 'Montant TTC augmenté : la facture devient partiellement payée');

-- Garde-fous ---------------------------------------------------------------

select throws_ok(
  $$ update public.invoices set amount_paid = 999 where id = 'f0000000-0000-4000-8000-000000000005' $$,
  '42501', null, 'Le montant réglé ne peut pas être saisi par l''utilisateur');

select throws_ok(
  $$ update public.invoices set supplier_id = 'e0000000-0000-4000-8000-000000000001'
     where id = 'f0000000-0000-4000-8000-000000000003' $$,
  'P0001', null, 'Une facture rattachée à des paiements ne change pas de fournisseur');

select * from finish();
rollback;
