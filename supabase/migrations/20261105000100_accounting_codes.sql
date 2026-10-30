-- =============================================================================
-- Export comptable mensuel (spec §11.2) : code comptable facultatif d'un fournisseur
-- (compte auxiliaire) et d'un compte bancaire (compte de trésorerie, ex. 51410001).
-- Les comptes par défaut et le format de l'export sont des paramètres de l'entreprise.
-- =============================================================================

alter table public.suppliers
  add column accounting_code text check (accounting_code ~ '^[A-Za-z0-9._-]{1,20}$');

alter table public.bank_accounts
  add column accounting_code text check (accounting_code ~ '^[A-Za-z0-9._-]{1,20}$');
