-- =============================================================================
-- Loi 69-21 (délais de paiement) : paramètres de l'amende et de la déclaration
-- trimestrielle, suivi des trimestres déclarés. Le calcul (retards, amendes,
-- état trimestriel) est fait par l'application à partir de ces paramètres.
-- =============================================================================

-- Paramètres légaux complémentaires, indicatifs (à valider par un expert-comptable)
insert into public.legal_settings (key, value, description) values
  ('late_fine_first_month_rate', 2.25,
   'Amende pour paiement hors délai : taux appliqué au montant payé en retard pour le premier mois ou fraction de mois, en % (loi 69-21, à valider par un expert-comptable).'),
  ('late_fine_additional_month_rate', 0.85,
   'Amende pour paiement hors délai : taux ajouté par mois ou fraction de mois supplémentaire, en % (loi 69-21, à valider par un expert-comptable).'),
  ('late_fine_min_invoice_amount', 0,
   'Montant TTC de facture en deçà duquel aucune amende n''est calculée, en DH (0 : toutes les factures).'),
  ('declaration_months_after_quarter', 1,
   'Déclaration trimestrielle des délais de paiement : à déposer au plus tard à la fin du N-ième mois qui suit le trimestre.'),
  ('declaration_revenue_threshold', 2000000,
   'Chiffre d''affaires annuel à partir duquel l''entreprise déclare ses délais de paiement, en DH (à valider par un expert-comptable).')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Trimestres déclarés : arrête le rappel et trace qui a déclaré, quand
-- -----------------------------------------------------------------------------

create table public.late_payment_declarations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  year smallint not null check (year between 2023 and 2100),
  quarter smallint not null check (quarter between 1 and 4),
  declared_on date not null,
  reference text check (length(trim(reference)) between 1 and 100),
  declared_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organization_id, year, quarter)
);

create trigger late_payment_declarations_audit
  after insert or update or delete on public.late_payment_declarations
  for each row execute function private.audit_row_change();

alter table public.late_payment_declarations enable row level security;

create policy "late_payment_declarations_select" on public.late_payment_declarations
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

-- Direction et comptabilité (dont l'expert-comptable externe, qui dépose souvent la déclaration)
create policy "late_payment_declarations_insert" on public.late_payment_declarations
  for insert to authenticated
  with check (organization_id in (select private.role_org_ids('{admin,manager,accountant,external_accountant}')));

create policy "late_payment_declarations_delete" on public.late_payment_declarations
  for delete to authenticated
  using (organization_id in (select private.role_org_ids('{admin,manager,accountant,external_accountant}')));

grant select, insert, delete on public.late_payment_declarations to authenticated;
