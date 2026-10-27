-- Cycle de vie des paiements (données du seed).
begin;

select plan(11);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';

-- Chèque 1003 (émis) remis au fournisseur
select lives_ok($$ update public.payments set status = 'delivered', delivered_at = '2026-10-20'
                   where id = '10000000-0000-4000-8000-000000000004' $$, 'Émis → remis');

select throws_ok($$ update public.payments set amount = 1 where id = '10000000-0000-4000-8000-000000000004' $$,
  'P0001', null, 'Le montant d''un paiement émis est figé');
select throws_ok($$ update public.payments set payee_name = 'Autre' where id = '10000000-0000-4000-8000-000000000004' $$,
  'P0001', null, 'Le bénéficiaire d''un paiement émis est figé');

-- Débit : date renseignée automatiquement
update public.payments set status = 'paid' where id = '10000000-0000-4000-8000-000000000004';
select isnt((select debited_at from public.payments where id = '10000000-0000-4000-8000-000000000004'), null,
  'Un paiement débité reçoit une date de débit');

-- Rapprochement défait : retour à « remis », date de débit effacée
update public.payments set status = 'delivered' where id = '10000000-0000-4000-8000-000000000004';
select is((select debited_at from public.payments where id = '10000000-0000-4000-8000-000000000004'), null,
  'Revenir avant le débit efface la date de débit');

-- Annulation : définitive, motif obligatoire
select throws_ok($$ update public.payments set status = 'cancelled' where id = '10000000-0000-4000-8000-000000000006' $$,
  '23514', null, 'Une annulation exige un motif');
select lives_ok($$ update public.payments set status = 'cancelled', cancellation_reason = 'Chèque déchiré'
                   where id = '10000000-0000-4000-8000-000000000006' $$, 'Annulation avec motif');
select isnt((select cancelled_at from public.payments where id = '10000000-0000-4000-8000-000000000006'), null,
  'La date d''annulation est renseignée par la base');
update public.payments set cancelled_at = '2020-01-01', notes = 'x' where id = '10000000-0000-4000-8000-000000000006';
select isnt((select cancelled_at::date from public.payments where id = '10000000-0000-4000-8000-000000000006'), '2020-01-01'::date,
  'La date d''annulation ne peut pas être modifiée');
select throws_ok($$ update public.payments set status = 'issued' where id = '10000000-0000-4000-8000-000000000005' $$,
  'P0001', null, 'Un paiement annulé ne revient jamais en circulation');

-- Un paiement débité ne peut pas être annulé (il faut d'abord défaire le rapprochement)
select throws_ok($$ update public.payments set status = 'cancelled', cancellation_reason = 'x'
                   where id = '10000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Un paiement débité ne peut pas être annulé');

select * from finish();
rollback;
