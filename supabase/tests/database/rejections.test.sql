-- Chèques et LCN rejetés, régularisation (données du seed).
--   Chèque 1003 (…004) : 8 450,50, émis, règle ATL-7781 (…f04)
--   LCN 5000101 (…008) : remise à Maghreb Emballages
begin;

select plan(14);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';

-- Rejet du chèque 1003 : un mois pour régulariser, la facture redevient à payer
select lives_ok($$ select public.reject_payment('10000000-0000-4000-8000-000000000004', 'insufficient_funds', 'Provision insuffisante', '2026-10-20') $$,
  'Déclaration du rejet');
select is(
  (select row(status, rejection_kind, rejected_at, regularization_due_date)::text from public.payments where id = '10000000-0000-4000-8000-000000000004'),
  row('rejected', 'insufficient_funds', '2026-10-20', '2026-11-20')::text,
  'Rejet : statut, motif, date et échéance de régularisation (un mois)'
);
select is((select status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000004'), 'unpaid',
  'La facture réglée par le chèque rejeté redevient à payer');
select ok(exists (select 1 from public.audit_log where action = 'reject' and record_id = '10000000-0000-4000-8000-000000000004'),
  'Le rejet est journalisé');

-- Nouvelle provision : le chèque est représenté
select lives_ok($$ select public.regularize_payment('10000000-0000-4000-8000-000000000004', 'new_provision', '2026-10-22') $$,
  'Régularisation par nouvelle provision');
select is(
  (select row(status, regularization_method, regularized_at)::text from public.payments where id = '10000000-0000-4000-8000-000000000004'),
  row('issued', 'new_provision', '2026-10-22')::text,
  'Le chèque revient en circulation, régularisé'
);
select is((select status::text from public.invoices where id = 'f0000000-0000-4000-8000-000000000004'), 'paid',
  'La facture est de nouveau réglée');

-- Second rejet, régularisé par virement : le chèque est annulé, le virement règle la facture
select public.reject_payment('10000000-0000-4000-8000-000000000004', 'insufficient_funds', null, '2026-10-24');
select is((select regularized_at from public.payments where id = '10000000-0000-4000-8000-000000000004'), null,
  'Un nouveau rejet rouvre la régularisation');
select public.record_transfer(
  'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000003', 8450.50, '2026-10-25', 'VIR-REGUL-1', true,
  '[{"invoice_id": "f0000000-0000-4000-8000-000000000004", "amount": 8450.50}]'::jsonb);
select throws_ok($$
  select public.regularize_payment('10000000-0000-4000-8000-000000000004', 'replacement', '2026-10-25',
    (select id from public.payments where reference = 'VIR-REGUL-1'))
$$, '22023', null, 'Le mode doit correspondre au paiement de remplacement');
select lives_ok($$
  select public.regularize_payment('10000000-0000-4000-8000-000000000004', 'transfer', '2026-10-25',
    (select id from public.payments where reference = 'VIR-REGUL-1'))
$$, 'Régularisation par virement');
select is(
  (select row(status, cancellation_reason)::text from public.payments where id = '10000000-0000-4000-8000-000000000004'),
  row('cancelled', 'Rejeté, remplacé par virement VIR-REGUL-1')::text,
  'Le chèque rejeté est annulé et renvoie à son remplaçant'
);

-- Contrôles
select throws_ok($$ select public.reject_payment('10000000-0000-4000-8000-000000000005', 'other', null, '2026-10-20') $$,
  'P0001', null, 'Un paiement annulé ne peut pas être rejeté');
select public.reject_payment('10000000-0000-4000-8000-000000000008', 'insufficient_funds', null, '2026-10-20');
select is((select regularization_due_date from public.payments where id = '10000000-0000-4000-8000-000000000008'), null,
  'LCN impayée : suivie sans compte à rebours légal');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';
select throws_ok($$ select public.reject_payment('10000000-0000-4000-8000-000000000006', 'other', null, '2026-10-20') $$,
  'P0002', null, 'Le comptable ne déclare pas de rejet');

select * from finish();
rollback;
