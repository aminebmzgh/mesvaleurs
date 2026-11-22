-- Portail fournisseur : lien secret géré par la direction, page publique limitée au fournisseur.
begin;

select plan(19);

-- Sotrama (e…01) : chèques débités, un chèque remis ; F-2026-0498 réglée. CAD (e…04) : un chèque annulé, factures ouvertes et contestée.
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';

select matches(public.renew_supplier_portal('e0000000-0000-4000-8000-000000000004'), '^[A-Za-z0-9_-]{32}$',
  'Le gestionnaire crée un lien de portail');
select set_config('test.first', (select token from public.supplier_portal_links where supplier_id = 'e0000000-0000-4000-8000-000000000004'), true);
select isnt(public.renew_supplier_portal('e0000000-0000-4000-8000-000000000004'), current_setting('test.first'),
  'Un nouveau lien remplace l''ancien');
select set_config('test.token', (select token from public.supplier_portal_links where supplier_id = 'e0000000-0000-4000-8000-000000000004'), true);
select is((select count(*)::int from public.supplier_portal_links), 1, 'Un seul lien par fournisseur');
select throws_ok($$ update public.supplier_portal_links set view_count = 99 $$, '42501', null,
  'Les liens ne se modifient pas directement');

-- Le préparateur voit le lien sans le gérer
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';
select is((select count(*)::int from public.supplier_portal_links), 1, 'Les membres voient les liens');
select throws_ok($$ select public.renew_supplier_portal('e0000000-0000-4000-8000-000000000004') $$,
  'P0002', null, 'Le préparateur ne crée pas de lien');
select throws_ok($$ select public.revoke_supplier_portal('e0000000-0000-4000-8000-000000000004') $$,
  'P0002', null, 'Le préparateur ne désactive pas de lien');

-- Autre entreprise
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "souss@demo.ma", "aal": "aal1"}';
select is((select count(*)::int from public.supplier_portal_links), 0, 'Liens invisibles des autres entreprises');
select throws_ok($$ select public.renew_supplier_portal('e0000000-0000-4000-8000-000000000004') $$,
  'P0002', null, 'Pas de lien pour le fournisseur d''une autre entreprise');

-- Visiteur anonyme (le fournisseur)
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(public.get_supplier_portal(current_setting('test.first')), null, 'L''ancien lien ne fonctionne plus');
select is(public.get_supplier_portal('pas-un-jeton'), null, 'Jeton invalide : rien');
select is(public.get_supplier_portal(current_setting('test.token')) -> 'supplier' ->> 'name', 'Centrale Agro Distribution',
  'Le lien ouvre le portail du fournisseur');
select is(
  (select array_agg(p ->> 'status' order by p ->> 'status') from jsonb_array_elements(public.get_supplier_portal(current_setting('test.token')) -> 'payments') p),
  array['issued'],
  'Seuls les règlements émis, remis, débités ou rejetés apparaissent (pas le chèque annulé)');
select is(
  (select array_agg(i ->> 'number' order by i ->> 'number') from jsonb_array_elements(public.get_supplier_portal(current_setting('test.token')) -> 'openInvoices') i),
  array['CAD-2026-332', 'CAD-2026-371'],
  'Factures ouvertes du fournisseur, contestée comprise');
select ok(
  not (public.get_supplier_portal(current_setting('test.token'))::text ~ '("rib"|"notes"|Sotrama|e0000000-0000-4000-8000-000000000001)'),
  'Ni RIB, ni notes, ni données d''un autre fournisseur');
select throws_ok($$ select * from public.supplier_portal_links $$, '42501', null, 'Le visiteur ne lit pas les liens');

-- Consultation comptée
reset role;
select is((select view_count from public.supplier_portal_links where supplier_id = 'e0000000-0000-4000-8000-000000000004'), 1,
  'Consultations rapprochées comptées une fois');

-- Offre Gratuit : le portail ne s'ouvre plus
update public.subscriptions set plan = 'free', trial_ends_at = null where organization_id = 'b0000000-0000-4000-8000-000000000001';
select is(public.get_supplier_portal(current_setting('test.token')), null, 'Offre sans portail : lien inactif');

-- Désactivation
update public.subscriptions set plan = 'pro' where organization_id = 'b0000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';
select public.revoke_supplier_portal('e0000000-0000-4000-8000-000000000004');
reset role;
set local role anon;
select is(public.get_supplier_portal(current_setting('test.token')), null, 'Lien désactivé : le portail ne s''ouvre plus');

select * from finish();
rollback;
