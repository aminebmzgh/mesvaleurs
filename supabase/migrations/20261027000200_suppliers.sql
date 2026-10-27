-- =============================================================================
-- Fournisseurs : anti-doublon et synthèse des soldes.
-- =============================================================================

-- Un même ICE ne désigne qu'un fournisseur par organisation (évite les doublons de fiche)
create unique index suppliers_org_ice_idx
  on public.suppliers (organization_id, ice)
  where ice is not null;

-- Synthèse par fournisseur. Les factures contestées sont exclues du solde dû et
-- comptées à part ; les chèques de garantie ne règlent aucune facture.
-- security_invoker : la RLS des tables sous-jacentes s'applique à l'utilisateur.
create view public.supplier_summaries
with (security_invoker = true)
as
select
  s.id,
  s.organization_id,
  coalesce(i.open_invoice_count, 0)::integer as open_invoice_count,
  coalesce(i.amount_due, 0)::numeric(14, 2) as amount_due,
  coalesce(i.amount_disputed, 0)::numeric(14, 2) as amount_disputed,
  coalesce(p.amount_in_circulation, 0)::numeric(14, 2) as amount_in_circulation,
  coalesce(p.amount_cashed, 0)::numeric(14, 2) as amount_cashed,
  p.last_payment_date
from public.suppliers s
left join lateral (
  select
    count(*) filter (where inv.status in ('unpaid', 'partially_paid')) as open_invoice_count,
    sum(inv.amount_incl_tax - inv.amount_paid) filter (where inv.status in ('unpaid', 'partially_paid'))
      as amount_due,
    sum(inv.amount_incl_tax - inv.amount_paid) filter (where inv.status = 'disputed') as amount_disputed
  from public.invoices inv
  where inv.supplier_id = s.id
) i on true
left join lateral (
  select
    sum(pay.amount) filter (where pay.status in ('issued', 'delivered') and pay.type <> 'guarantee_check')
      as amount_in_circulation,
    sum(pay.amount) filter (where pay.status = 'paid' and pay.type <> 'guarantee_check') as amount_cashed,
    max(pay.issue_date) filter (where pay.status not in ('draft', 'cancelled')) as last_payment_date
  from public.payments pay
  where pay.supplier_id = s.id
) p on true;
