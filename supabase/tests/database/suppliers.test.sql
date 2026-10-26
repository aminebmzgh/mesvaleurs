-- Fournisseurs : anti-doublon et synthèse des soldes (données du seed).
begin;

select plan(5);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

select throws_ok(
  $$ insert into public.suppliers (organization_id, name, ice)
     values ('b0000000-0000-4000-8000-000000000001', 'Sotrama bis', '001234567000089') $$,
  '23505', null, 'Un ICE déjà enregistré dans l''entreprise est refusé');

select lives_ok(
  $$ insert into public.suppliers (organization_id, name) values ('b0000000-0000-4000-8000-000000000001', 'Sans ICE 1'),
       ('b0000000-0000-4000-8000-000000000001', 'Sans ICE 2') $$,
  'Plusieurs fournisseurs sans ICE sont acceptés');

-- Sotrama : F-2026-0412 soldée et encaissée (2 × 24 000), F-2026-0498 réglée par un chèque remis
select results_eq(
  $$ select open_invoice_count, amount_due, amount_in_circulation, amount_cashed from public.supplier_summaries
     where id = 'e0000000-0000-4000-8000-000000000001' $$,
  $$ values (0, 0.00::numeric(14, 2), 15600.00::numeric(14, 2), 48000.00::numeric(14, 2)) $$,
  'Sotrama : rien à payer, 15 600 en circulation, 48 000 encaissés');

-- Centrale Agro : CAD-2026-332 partiellement réglée (reste 20 000), CAD-2026-371 contestée (18 900)
select results_eq(
  $$ select open_invoice_count, amount_due, amount_disputed, amount_in_circulation from public.supplier_summaries
     where id = 'e0000000-0000-4000-8000-000000000004' $$,
  $$ values (1, 20000.00::numeric(14, 2), 18900.00::numeric(14, 2), 12000.00::numeric(14, 2)) $$,
  'Centrale Agro : le chèque annulé et la facture contestée sont exclus des montants à payer');

-- Isolation de la vue
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "souss@demo.ma", "aal": "aal1"}';
select is((select count(*) from public.supplier_summaries)::int, 1, 'La synthèse respecte l''isolation des entreprises');

select * from finish();
rollback;
