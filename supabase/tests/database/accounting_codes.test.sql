-- Codes comptables des fournisseurs et des comptes bancaires (export comptable).
begin;

select plan(3);

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "email": "gestionnaire@demo.ma", "aal": "aal1"}';

select lives_ok($$ update public.suppliers set accounting_code = 'FSOTRAMA' where id = 'e0000000-0000-4000-8000-000000000001' $$,
  'Un code comptable valide est accepté');
select throws_ok($$ update public.suppliers set accounting_code = '4411 000' where id = 'e0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'Un code avec espace est refusé');
select throws_ok($$ update public.bank_accounts set accounting_code = repeat('5', 21) where id = 'c0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'Un code de plus de 20 caractères est refusé');

select * from finish();
rollback;
