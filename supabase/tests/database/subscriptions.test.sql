-- Offres et abonnements : essai à la création, abonnement non modifiable depuis
-- l'application, limites de l'offre Gratuit, double signature hors Business.
--   Souss Négoce (b…002) : 1 membre (admin a…005), 1 compte bancaire (c…003)
begin;

select plan(13);

-- Essai de 14 jours pour les entreprises existantes et les nouvelles
select ok((select trial_ends_at > now() + interval '13 days' from public.subscriptions
  where organization_id = 'b0000000-0000-4000-8000-000000000001'), 'Entreprise existante : essai de 14 jours');

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "admin@souss.ma", "aal": "aal1"}';

create temp table new_org as select public.create_organization('Nouvelle SARL') as id;
select ok((select plan = 'free' and trial_ends_at > now() + interval '13 days' from public.subscriptions
  where organization_id = (select id from new_org)),
  'Nouvelle entreprise : offre Gratuit avec 14 jours d''essai de l''offre Business');
select is((select count(*)::int from public.subscriptions), 2, 'Chacun ne voit que l''abonnement de ses entreprises');
select throws_ok($$ update public.subscriptions set plan = 'business', trial_ends_at = null
  where organization_id = 'b0000000-0000-4000-8000-000000000002' $$,
  '42501', null, 'Un administrateur ne change pas lui-même son offre');

-- Fin de l'essai : offre Gratuit
reset role;
update public.subscriptions set plan = 'free', trial_ends_at = null where organization_id = 'b0000000-0000-4000-8000-000000000002';
set local role authenticated;

select throws_ok($$ insert into public.invitations (organization_id, email, role)
  values ('b0000000-0000-4000-8000-000000000002', 'nouveau@souss.ma', 'preparer') $$,
  'P0001', 'Votre offre Gratuit permet 1 utilisateur(s). Passez à une offre supérieure pour ajouter un membre.',
  'Gratuit : 1 utilisateur, pas d''invitation');

select throws_ok($$ insert into public.bank_accounts (organization_id, bank_id, label, rib)
  values ('b0000000-0000-4000-8000-000000000002', (select id from public.banks where name = 'Attijariwafa bank' and organization_id is null),
    'Second compte', '007780000123456789012396') $$,
  'P0001', 'Votre offre Gratuit permet 1 compte(s) bancaire(s) actif(s). Archivez un compte ou passez à une offre supérieure.',
  'Gratuit : 1 compte bancaire actif');
update public.bank_accounts set is_active = false where id = 'c0000000-0000-4000-8000-000000000003';
select lives_ok($$ update public.bank_accounts set is_active = true where id = 'c0000000-0000-4000-8000-000000000003' $$,
  'Réactiver son unique compte reste possible');

-- 10 paiements par mois (déjà créés ce mois-ci compris), puis refus
select lives_ok($$
  select public.record_transfer('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003',
    'e0000000-0000-4000-8000-000000000006', 100.00, '2026-10-20', 'VIR-LIMITE-' || n, true)
  from generate_series(1, 10 - (select count(*)::int from public.payments
    where organization_id = 'b0000000-0000-4000-8000-000000000002'
      and created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')) n
$$, 'Gratuit : jusqu''à 10 paiements dans le mois');
select throws_ok($$
  select public.record_transfer('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003',
    'e0000000-0000-4000-8000-000000000006', 100.00, '2026-10-20', 'VIR-LIMITE-11', true)
$$, 'P0001', 'Votre offre Gratuit permet 10 paiements par mois. Passez à l''offre Pro pour des paiements illimités.',
  'Gratuit : le 11e paiement du mois est refusé');

-- Offre Pro : 3 utilisateurs, 2 comptes, paiements illimités
reset role;
update public.subscriptions set plan = 'pro' where organization_id = 'b0000000-0000-4000-8000-000000000002';
set local role authenticated;
select lives_ok($$
  select public.record_transfer('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003',
    'e0000000-0000-4000-8000-000000000006', 100.00, '2026-10-20', 'VIR-LIMITE-11', true)
$$, 'Pro : paiements illimités');
select lives_ok($$ insert into public.invitations (organization_id, email, role) values
  ('b0000000-0000-4000-8000-000000000002', 'un@souss.ma', 'preparer'),
  ('b0000000-0000-4000-8000-000000000002', 'deux@souss.ma', 'accountant') $$,
  'Pro : deux invitations en plus de l''administrateur');
select throws_ok($$ insert into public.invitations (organization_id, email, role)
  values ('b0000000-0000-4000-8000-000000000002', 'trois@souss.ma', 'preparer') $$,
  'P0001', null, 'Pro : les invitations en attente comptent dans les 3 utilisateurs');

-- Double signature : sans effet hors Business et Cabinet
reset role;
update public.organizations set settings = settings || '{"approval_threshold": 1}'::jsonb
where id = 'b0000000-0000-4000-8000-000000000002';
select is(private.approval_reasons('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000006', '2026-10-20', array[500.00]),
  '[]'::jsonb, 'Pro : seuil de double signature ignoré');

select * from finish();
rollback;
