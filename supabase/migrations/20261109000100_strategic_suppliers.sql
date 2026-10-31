-- Optimiseur de paiements (spec §11 bis J) : fournisseurs stratégiques, servis en priorité
-- quand la trésorerie ne permet pas de tout payer.
alter table public.suppliers
  add column is_strategic boolean not null default false;

comment on column public.suppliers.is_strategic is
  'Fournisseur stratégique : ses factures passent en priorité dans le plan de paiement proposé.';
