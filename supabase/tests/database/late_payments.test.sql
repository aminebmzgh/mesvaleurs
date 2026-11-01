-- Loi 69-21 : paramètres de l'amende et suivi des trimestres déclarés.
begin;

select plan(8);

select is((select value from public.legal_settings where key = 'late_fine_first_month_rate'), 2.25::numeric,
  'Amende : taux du premier mois');
select is((select value from public.legal_settings where key = 'late_fine_additional_month_rate'), 0.85::numeric,
  'Amende : taux par mois supplémentaire');

-- Comptable : peut marquer un trimestre comme déclaré
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000004", "role": "authenticated", "email": "comptable@demo.ma", "aal": "aal1"}';

select lives_ok($$
  insert into public.late_payment_declarations (organization_id, year, quarter, declared_on, reference)
  values ('b0000000-0000-4000-8000-000000000001', 2026, 3, '2026-10-20', 'DGI-123')
$$, 'La comptabilité marque le trimestre comme déclaré');
select is((select declared_by from public.late_payment_declarations where year = 2026 and quarter = 3),
  'a0000000-0000-4000-8000-000000000004'::uuid, 'Auteur enregistré');
select throws_ok($$
  insert into public.late_payment_declarations (organization_id, year, quarter, declared_on)
  values ('b0000000-0000-4000-8000-000000000001', 2026, 3, '2026-10-21')
$$, '23505', null, 'Un trimestre n''est déclaré qu''une fois');
select throws_ok($$
  insert into public.late_payment_declarations (organization_id, year, quarter, declared_on)
  values ('b0000000-0000-4000-8000-000000000002', 2026, 3, '2026-10-21')
$$, '42501', null, 'Refusé pour une autre entreprise');

-- Préparateur : consultation seule
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000003", "role": "authenticated", "email": "preparateur@demo.ma", "aal": "aal1"}';
select is((select count(*)::integer from public.late_payment_declarations), 1, 'Le préparateur voit les déclarations');
select throws_ok($$
  insert into public.late_payment_declarations (organization_id, year, quarter, declared_on)
  values ('b0000000-0000-4000-8000-000000000001', 2026, 2, '2026-07-20')
$$, '42501', null, 'Le préparateur ne déclare pas');

select * from finish();
rollback;
