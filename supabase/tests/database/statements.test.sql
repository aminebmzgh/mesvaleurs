-- Relevés et rapprochement (données du seed : relevé Attijariwafa d'octobre 2026).
begin;

select plan(14);

-- Solde : 250 000 + 50 000 − 24 000 − 24 000 − 45 − 15 060 − 3 200
select is((select current_balance from public.bank_accounts where id = 'c0000000-0000-4000-8000-000000000001'),
  233695.00::numeric, 'Le solde courant intègre les mouvements du relevé');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';

-- Nouvel import : un débit du chèque 1003 (8 450,50)
insert into public.statement_imports (id, organization_id, bank_account_id, format, status, file_hash)
values ('20000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001', 'csv', 'processing', 'test-hash');
insert into public.statement_lines (id, organization_id, import_id, bank_account_id, operation_date, label, debit,
  extracted_number, extracted_kind, line_hash)
values ('30000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-0000000000a1', 'c0000000-0000-4000-8000-000000000001', '2026-10-28',
  'CHQ 0001003 ATL', 8450.50, 1003, 'check', 'test-line-1');

select is((select current_balance from public.bank_accounts where id = 'c0000000-0000-4000-8000-000000000001'),
  225244.50::numeric, 'Un nouveau débit diminue le solde');

select throws_ok($$
  insert into public.statement_lines (organization_id, import_id, bank_account_id, operation_date, label, debit, line_hash)
  values ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-0000000000a1',
    'c0000000-0000-4000-8000-000000000001', '2026-10-28', 'CHQ 0001003 ATL', 8450.50, 'test-line-1')
$$, '23505', null, 'Une ligne déjà importée est refusée (doublon)');

-- Application du rapprochement automatique
select lives_ok($$
  select public.apply_statement_matches('20000000-0000-4000-8000-0000000000a1',
    '[{"line_id": "30000000-0000-4000-8000-0000000000a1", "payment_id": "10000000-0000-4000-8000-000000000004",
       "status": "auto_matched", "confidence": 100, "reason": "Numéro et montant identiques"}]')
$$, 'Le rapprochement automatique s''applique');

select results_eq(
  $$ select status::text, debited_at from public.payments where id = '10000000-0000-4000-8000-000000000004' $$,
  $$ values ('paid', '2026-10-28'::date) $$,
  'Le chèque passe en « débité » à la date de l''opération');
select is((select amount_cashed from public.invoices where id = 'f0000000-0000-4000-8000-000000000004'),
  8450.50::numeric(14, 2), 'La facture réglée devient encaissée');
select is((select status::text from public.statement_imports where id = '20000000-0000-4000-8000-0000000000a1'),
  'completed', 'Import entièrement rapproché : terminé');

-- Confirmation d'une proposition (relevé du seed : chèque 1002 débité 15 060 au lieu de 15 600)
select lives_ok($$ select public.confirm_statement_line(
  (select id from public.statement_lines where label = 'CHEQUE 1002'), '10000000-0000-4000-8000-000000000003') $$,
  'Une proposition « à confirmer » est validée');
select is((select status::text from public.payments where id = '10000000-0000-4000-8000-000000000003'),
  'paid', 'Le chèque confirmé est débité');

-- Un paiement ne peut pas être rapproché à deux lignes
select throws_ok($$ select public.confirm_statement_line(
  (select id from public.statement_lines where label = 'CHQ 0001017'), '10000000-0000-4000-8000-000000000003') $$,
  'P0001', null, 'Un paiement déjà débité ne peut pas être rapproché une seconde fois');

-- Rapprochement défait : le chèque redevient « remis » (il avait été remis au fournisseur)
select lives_ok($$ select public.unmatch_statement_line((select id from public.statement_lines where label = 'CHEQUE 1002')) $$,
  'Un rapprochement peut être défait');
select results_eq(
  $$ select status::text, debited_at from public.payments where id = '10000000-0000-4000-8000-000000000003' $$,
  $$ values ('delivered', null::date) $$,
  'Le paiement revient en circulation, sans date de débit');

-- Ligne de frais : ignorée
select lives_ok($$ select public.set_statement_line_ignored((select id from public.statement_lines where label = 'FRAIS TENUE DE COMPTE'), true) $$,
  'Une ligne de frais peut être ignorée');

-- Préparateur : le rapprochement est réservé aux administrateurs et gestionnaires
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';
select throws_ok($$ select public.confirm_statement_line(
  (select id from public.statement_lines where label = 'CHEQUE 1002'), '10000000-0000-4000-8000-000000000003') $$,
  'P0002', null, 'Le préparateur ne peut pas rapprocher (ligne invisible en écriture)');

select * from finish();
rollback;
