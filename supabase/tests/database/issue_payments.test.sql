-- Émission d'un lot de paiements (données du seed : organisation Atlas).
begin;

select plan(15);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

-- Le préparateur règle ATL-7845 (6 200) et BP… n'est pas concerné : 2 chèques de 3 100
select lives_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000003', '', '2026-10-26', 'Casablanca',
    '[{"amount": 3100}, {"amount": 3100}]',
    '[{"index": 0, "invoice_id": "f0000000-0000-4000-8000-000000000005", "amount": 3100},
      {"index": 1, "invoice_id": "f0000000-0000-4000-8000-000000000005", "amount": 3100}]'
  )
$$, 'Le préparateur émet deux chèques');

select results_eq(
  $$ select number, status::text, payee_name, amount from public.payments
     where supplier_id = 'e0000000-0000-4000-8000-000000000003' and issue_date = '2026-10-26' order by number $$,
  $$ values (1006::bigint, 'issued', 'ATLAS TRANSPORT ET LOGISTIQUE', 3100.00::numeric(14, 2)),
            (1007::bigint, 'issued', 'ATLAS TRANSPORT ET LOGISTIQUE', 3100.00::numeric(14, 2)) $$,
  'Numéros attribués à la suite, bénéficiaire par défaut = nom imprimé du fournisseur');

select is((select next_number from public.checkbooks where id = 'd0000000-0000-4000-8000-000000000001'),
  1008::bigint, 'Le carnet avance du nombre de formules émises');

select results_eq(
  $$ select amount_paid, status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000005' $$,
  $$ values (6200.00::numeric(14, 2), 'paid') $$,
  'La facture est réglée');

-- Le journal n'est pas lisible par le préparateur : vérification côté propriétaire de la base
reset role;
select isnt_empty(
  $$ select 1 from public.audit_log where action = 'issue' and details ->> 'first_number' = '1006'
       and actor_id = 'a0000000-0000-4000-8000-000000000003' $$,
  'L''émission est journalisée avec son auteur');
set local role authenticated;

-- LCN échelonnées sur le carnet LCN : échéance obligatoire
select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000002', 'MAGHREB EMBALLAGES', '2026-10-26', 'Casablanca',
    '[{"amount": 1000}]'
  )
$$, '22023', null, 'Une LCN sans échéance est refusée');

select lives_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000002', 'MAGHREB EMBALLAGES', '2026-10-26', 'Casablanca',
    '[{"amount": 500, "due_date": "2026-11-25"}, {"amount": 500, "due_date": "2026-12-25"}]'
  )
$$, 'Deux LCN échelonnées sans facture (acompte)');
select results_eq(
  $$ select number, due_date from public.payments where checkbook_id = 'd0000000-0000-4000-8000-000000000002'
     and issue_date = '2026-10-26' order by number $$,
  $$ values (5000103::bigint, '2026-11-25'::date), (5000104::bigint, '2026-12-25'::date) $$,
  'Les LCN portent leurs échéances');

-- Contrôles ---------------------------------------------------------------

select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000004', '', '2026-10-26', 'Casablanca',
    '[{"amount": 1000}]',
    '[{"index": 0, "invoice_id": "f0000000-0000-4000-8000-000000000008", "amount": 1000}]'
  )
$$, 'P0002', null, 'Une facture contestée ne peut pas être réglée');

select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000004', '', '2026-10-26', 'Casablanca',
    '[{"amount": 1000}]',
    '[{"index": 0, "invoice_id": "f0000000-0000-4000-8000-000000000001", "amount": 1000}]'
  )
$$, 'P0002', null, 'Une facture d''un autre fournisseur est refusée');

select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000004', '', '2026-10-26', 'Casablanca',
    '[{"amount": 1000}]',
    '[{"index": 0, "invoice_id": "f0000000-0000-4000-8000-000000000006", "amount": 900}]'
  )
$$, '22023', null, 'Le montant affecté doit égaler le montant de la formule');

-- Carnet de LCN : 5000105 à 5000124, soit 20 formules restantes
select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000002', '', '2026-10-26', 'Casablanca',
    (select jsonb_agg(jsonb_build_object('amount', 10, 'due_date', '2026-12-31')) from generate_series(1, 21))
  )
$$, 'P0001', 'Formules insuffisantes : il reste 20 formule(s) dans ce carnet.',
  'Formules insuffisantes dans le carnet');

-- Un échec n'a rien laissé : le carnet n'a pas bougé depuis la dernière émission réussie
select is((select next_number from public.checkbooks where id = 'd0000000-0000-4000-8000-000000000001'),
  1008::bigint, 'Une émission refusée ne consomme aucun numéro');

-- Comptable : lecture seule
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';
select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000003', '', '2026-10-26', 'Casablanca', '[{"amount": 10}]'
  )
$$, '42501', null, 'Le comptable ne peut pas émettre de paiements');

-- Autre organisation
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "souss@demo.ma", "aal": "aal1"}';
select throws_ok($$
  select public.issue_payments(
    'b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000006', '', '2026-10-26', 'Agadir', '[{"amount": 10}]'
  )
$$, 'P0002', null, 'Impossible d''utiliser le carnet d''une autre organisation');

select * from finish();
rollback;
