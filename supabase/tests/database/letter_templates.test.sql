-- Modèles de lettres : droits d'écriture et isolation (données du seed).
begin;

select plan(5);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';
select lives_ok($$
  insert into public.letter_templates (organization_id, name, subject, body, closing)
  values ('b0000000-0000-4000-8000-000000000001', 'Maison', 'Règlement {reference}', 'Ci-joint {moyens}.', 'Cordialement.')
$$, 'Le gestionnaire crée un modèle');
select throws_ok($$
  insert into public.letter_templates (organization_id, name, subject, body, closing)
  values ('b0000000-0000-4000-8000-000000000001', 'MAISON', 'x', 'y', '')
$$, '23505', null, 'Deux modèles ne portent pas le même nom');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';
select is((select count(*)::int from public.letter_templates), 1, 'Le préparateur lit les modèles de son entreprise');
select throws_ok($$
  insert into public.letter_templates (organization_id, name, subject, body, closing)
  values ('b0000000-0000-4000-8000-000000000001', 'Autre', 'x', 'y', '')
$$, '42501', null, 'Le préparateur ne crée pas de modèle');

set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000005", "role": "authenticated", "email": "souss@demo.ma", "aal": "aal1"}';
select is_empty($$ select id from public.letter_templates $$, 'Une autre entreprise ne voit pas ces modèles');

select * from finish();
rollback;
