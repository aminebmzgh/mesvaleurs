-- Double signature et plafonds (seed : chéquier 1000–1049, prochain n° 1006 ; BP-10293 de 2 340 DH non payée).
begin;

select plan(22);

-- Seuil de l'entreprise : validation au-delà de 2 000 DH par formule
update public.organizations set settings = settings || '{"approval_threshold": 2000}'::jsonb
where id = 'b0000000-0000-4000-8000-000000000001';

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';

-- Lot au-delà du seuil : préparé, numéro réservé, en brouillon
insert into ids select 'over', public.issue_payments(
  'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000005', '', '2026-10-28', 'Casablanca',
  '[{"amount": 2340}]', '[{"index": 0, "invoice_id": "f0000000-0000-4000-8000-000000000007", "amount": 2340}]');
select is((select row(approval_status, approval_reasons -> 0 ->> 'kind')::text from public.print_batches where id = (select id from ids where name = 'over')),
  row('pending', 'threshold')::text, 'Formule au-delà du seuil : lot à valider, motif « seuil »');
select is((select row(status, number)::text from public.payments where print_batch_id = (select id from ids where name = 'over')),
  row('draft', 1006)::text, 'Le numéro est réservé, le paiement reste en brouillon');
select is((select next_number from public.checkbooks where id = 'd0000000-0000-4000-8000-000000000001'), 1007::bigint,
  'Le carnet avance dès la préparation');
select is((select amount_paid from public.invoices where id = 'f0000000-0000-4000-8000-000000000007'), 0.00::numeric(14, 2),
  'Un lot à valider ne règle pas encore la facture');

-- Aucun contournement par le préparateur
select throws_ok($$ update public.payments set status = 'issued' where print_batch_id = (select id from ids where name = 'over') $$,
  'P0001', null, 'Le préparateur ne fait pas sortir son paiement du brouillon');
select throws_ok($$ update public.payments set amount = 1999 where print_batch_id = (select id from ids where name = 'over') $$,
  'P0001', null, 'Un paiement préparé est figé');
update public.print_batches set approval_status = 'approved' where id = (select id from ids where name = 'over');
select is((select approval_status::text from public.print_batches where id = (select id from ids where name = 'over')), 'pending',
  'Le préparateur ne modifie pas le statut de validation du lot');
select throws_ok($$ select public.approve_batch((select id from ids where name = 'over')) $$,
  'P0002', null, 'Le préparateur ne valide pas');
select throws_ok($$ select public.record_batch_print((select id from ids where name = 'over')) $$,
  'P0001', null, 'Un lot à valider ne s''imprime pas');
select throws_ok($$ insert into public.payments (organization_id, type, status, bank_account_id, checkbook_id, number, supplier_id, payee_name, amount)
  values ('b0000000-0000-4000-8000-000000000001', 'check', 'issued', 'c0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001', 1040, 'e0000000-0000-4000-8000-000000000005', 'X', 10) $$,
  '42501', null, 'Les paiements ne s''insèrent pas directement');
select throws_ok($$ update public.suppliers set daily_ceiling = 1000000 where id = 'e0000000-0000-4000-8000-000000000005' $$,
  '42501', null, 'Le préparateur ne fixe pas le plafond d''un fournisseur');

-- Sous le seuil : émis directement
insert into ids select 'under', public.issue_payments(
  'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000005', '', '2026-10-28', 'Casablanca', '[{"amount": 500}]');
select is((select row(b.approval_status, p.status)::text from public.print_batches b join public.payments p on p.print_batch_id = b.id
  where b.id = (select id from ids where name = 'under')), row('not_required', 'issued')::text, 'Sous le seuil et les plafonds : émis directement');

-- Validation par le gestionnaire
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';
select lives_ok($$ select public.approve_batch((select id from ids where name = 'over')) $$, 'Le gestionnaire valide le lot');
select is((select row(b.approval_status, b.decided_by, p.status)::text from public.print_batches b join public.payments p on p.print_batch_id = b.id
  where b.id = (select id from ids where name = 'over')),
  row('approved', 'a0000000-0000-4000-8000-000000000002', 'issued')::text, 'Validé : paiement émis, valideur enregistré');
select is((select amount_paid from public.invoices where id = 'f0000000-0000-4000-8000-000000000007'), 2340.00::numeric(14, 2),
  'Après validation, la facture est réglée');
select lives_ok($$ select public.record_batch_print((select id from ids where name = 'over')) $$, 'Le lot validé s''imprime');

-- Lot préparé par le gestionnaire : une autre personne doit le valider
insert into ids select 'own', public.issue_payments(
  'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000005', '', '2026-10-28', 'Casablanca', '[{"amount": 9000}]');
select throws_ok($$ select public.approve_batch((select id from ids where name = 'own')) $$,
  'P0001', null, 'On ne valide pas son propre lot');

-- Plafond journalier du préparateur : 3 000 DH (déjà 2 340 + 500 émis ce jour)
reset role;
update public.memberships set daily_ceiling = 3000
where organization_id = 'b0000000-0000-4000-8000-000000000001' and user_id = 'a0000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';
insert into ids select 'ceiling', public.issue_payments(
  'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000005', '', '2026-10-28', 'Casablanca', '[{"amount": 200}]');
select is(
  (select approval_reasons -> 0 from public.print_batches where id = (select id from ids where name = 'ceiling')),
  '{"kind": "user_daily", "limit": 3000.00, "total": 3040.00}'::jsonb,
  'Plafond journalier de l''utilisateur dépassé : lot à valider, avec le total');

-- Refus par l'administrateur
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated", "email": "admin@demo.ma", "aal": "aal1"}';
select throws_ok($$ select public.refuse_batch((select id from ids where name = 'ceiling'), '') $$,
  '22023', null, 'Un refus exige un motif');
select lives_ok($$ select public.refuse_batch((select id from ids where name = 'ceiling'), 'Pas prioritaire') $$, 'L''administrateur refuse le lot');
select is((select row(p.status, p.cancellation_reason, b.approval_status)::text from public.print_batches b join public.payments p on p.print_batch_id = b.id
  where b.id = (select id from ids where name = 'ceiling')),
  row('cancelled', 'Refusé à la validation : Pas prioritaire', 'refused')::text, 'Refusé : paiement annulé avec le motif, numéro conservé');
select is((select count(*)::integer from public.audit_log where table_name = 'print_batches' and action in ('approve', 'refuse')), 2,
  'Validations et refus tracés au journal d''audit');

select * from finish();
rollback;
