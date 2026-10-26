-- =============================================================================
-- Données de démonstration (environnement local et préproduction uniquement).
-- Mot de passe de tous les comptes : Demo1234
--
--   admin@demo.ma        Administrateur   Atlas Distribution SARL
--   gestionnaire@demo.ma Gestionnaire     Atlas Distribution SARL
--   preparateur@demo.ma  Préparateur      Atlas Distribution SARL
--   comptable@demo.ma    Comptable        Atlas Distribution SARL
--   souss@demo.ma        Administrateur   Souss Négoce SARL (2e organisation,
--                                         sert à vérifier l'isolation des données)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilisateurs
-- -----------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Demo1234', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@demo.ma', 'Karim Benali'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'gestionnaire@demo.ma', 'Salma El Idrissi'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'preparateur@demo.ma', 'Youssef Amrani'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'comptable@demo.ma', 'Nadia Tazi'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'souss@demo.ma', 'Hassan Ouali')
) as u (id, email, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@demo.ma';

update public.profiles set job_title = 'Gérant' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set job_title = 'Responsable administratif et financier' where id = 'a0000000-0000-4000-8000-000000000002';

-- -----------------------------------------------------------------------------
-- Organisations et adhésions
-- -----------------------------------------------------------------------------

insert into public.organizations (id, name, ice, tax_id, trade_register, address, city, phone, email, annual_revenue) values
  ('b0000000-0000-4000-8000-000000000001', 'Atlas Distribution SARL', '002345678000041', '40123456', 'RC Casablanca 412345',
   '45, boulevard Zerktouni', 'Casablanca', '+212 522 00 00 00', 'contact@atlas-distribution.ma', 18500000),
  ('b0000000-0000-4000-8000-000000000002', 'Souss Négoce SARL', '003456789000052', '50234567', 'RC Agadir 98765',
   'Avenue Hassan II', 'Agadir', '+212 528 00 00 00', 'contact@souss-negoce.ma', 4200000);

insert into public.memberships (organization_id, user_id, role) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'manager'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'preparer'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'accountant'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'admin');

update public.profiles set last_organization_id = 'b0000000-0000-4000-8000-000000000001'
where id in (
  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004'
);
update public.profiles set last_organization_id = 'b0000000-0000-4000-8000-000000000002'
where id = 'a0000000-0000-4000-8000-000000000005';

-- -----------------------------------------------------------------------------
-- Comptes bancaires et chéquiers (Atlas Distribution)
-- -----------------------------------------------------------------------------

insert into public.bank_accounts (id, organization_id, bank_id, label, branch, rib, opening_balance, opening_balance_date, current_balance) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   (select id from public.banks where name = 'Attijariwafa bank' and organization_id is null),
   'Compte principal', 'Casablanca Zerktouni', '007780000123456789012396', 250000.00, '2026-07-01', 233695.00),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   (select id from public.banks where name = 'Banque Populaire' and organization_id is null),
   'Compte LCN', 'Casablanca Maârif', '145780000987654321098721', 180000.00, '2026-07-01', 140000.00),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   (select id from public.banks where name = 'Société Générale Maroc' and organization_id is null),
   'Compte courant', 'Agadir centre', '022810000456789123456714', 75000.00, '2026-07-01', 75000.00);

insert into public.checkbooks (id, organization_id, bank_account_id, type, first_number, last_number, next_number, received_at) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'check', 1000, 1049, 1006, '2026-07-01'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'lcn', 5000100, 5000124, 5000103, '2026-07-01'),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-000000000003', 'check', 3000, 3024, 3000, '2026-07-15');

-- -----------------------------------------------------------------------------
-- Fournisseurs
-- -----------------------------------------------------------------------------

insert into public.suppliers (id, organization_id, name, payee_name, ice, city, contact_name, email, phone, payment_terms_days) values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Sotrama Matériaux SARL', 'SOTRAMA MATERIAUX', '001234567000089', 'Casablanca', 'M. Alaoui', 'compta@sotrama.ma', '+212 522 11 11 11', 60),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'Maghreb Emballages SA', 'MAGHREB EMBALLAGES', '001987654000023', 'Tanger', 'Mme Chraibi', 'recouvrement@maghreb-emballages.ma', '+212 539 22 22 22', 90),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   'Atlas Transport & Logistique', 'ATLAS TRANSPORT ET LOGISTIQUE', '002468135000076', 'Casablanca', 'M. Berrada', 'factures@atl.ma', '+212 522 33 33 33', 30),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001',
   'Centrale Agro Distribution', 'CENTRALE AGRO DISTRIBUTION', '001357924000058', 'Meknès', 'M. Fassi', 'contact@cad.ma', '+212 535 44 44 44', 60),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001',
   'Bureau Pro Fournitures', 'BUREAU PRO', null, 'Rabat', 'Mme Bennani', 'ventes@bureaupro.ma', '+212 537 55 55 55', 30),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002',
   'Agadir Pêche Industrie', 'AGADIR PECHE INDUSTRIE', '004567891000034', 'Agadir', 'M. Amzil', 'compta@api.ma', '+212 528 66 66 66', 60);

-- -----------------------------------------------------------------------------
-- Factures
-- (amount_paid « réglée », amount_cashed « encaissée » et status sont cohérents avec les paiements ci-dessous)
-- -----------------------------------------------------------------------------

insert into public.invoices (id, organization_id, supplier_id, number, issue_date, delivery_date,
  amount_excl_tax, vat_amount, amount_incl_tax, amount_paid, amount_cashed, status) values
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
   'F-2026-0412', '2026-08-05', '2026-08-04', 40000.00, 8000.00, 48000.00, 48000.00, 48000.00, 'paid'),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
   'F-2026-0498', '2026-09-12', '2026-09-12', 13000.00, 2600.00, 15600.00, 15600.00, 0, 'paid'),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
   'ME/26/1187', '2026-07-20', '2026-07-18', 100000.00, 20000.00, 120000.00, 120000.00, 40000.00, 'paid'),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003',
   'ATL-7781', '2026-09-28', '2026-09-28', 7682.27, 768.23, 8450.50, 8450.50, 0, 'paid'),
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003',
   'ATL-7845', '2026-10-10', '2026-10-10', 5636.36, 563.64, 6200.00, 0, 0, 'unpaid'),
  ('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   'CAD-2026-332', '2026-08-30', '2026-08-29', 26666.67, 5333.33, 32000.00, 12000.00, 0, 'partially_paid'),
  ('f0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005',
   'BP-10293', '2026-10-02', '2026-10-02', 1950.00, 390.00, 2340.00, 0, 0, 'unpaid'),
  ('f0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   'CAD-2026-371', '2026-09-15', '2026-09-15', 15750.00, 3150.00, 18900.00, 0, 0, 'disputed'),
  ('f0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000006',
   'API-2026-0077', '2026-09-01', '2026-09-01', 25000.00, 5000.00, 30000.00, 0, 0, 'unpaid');

-- -----------------------------------------------------------------------------
-- Paiements
-- -----------------------------------------------------------------------------

insert into public.payments (id, organization_id, type, status, bank_account_id, checkbook_id, number,
  supplier_id, payee_name, amount, issue_date, issue_place, due_date, delivered_at, debited_at,
  cancellation_reason, created_by) values
  -- Facture F-2026-0412 réglée en deux chèques, tous deux débités
  ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'check', 'paid',
   'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1000,
   'e0000000-0000-4000-8000-000000000001', 'SOTRAMA MATERIAUX', 24000.00, '2026-09-25', 'Casablanca', null, '2026-09-26', '2026-10-03',
   null, 'a0000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'check', 'paid',
   'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1001,
   'e0000000-0000-4000-8000-000000000001', 'SOTRAMA MATERIAUX', 24000.00, '2026-09-25', 'Casablanca', null, '2026-09-26', '2026-10-06',
   null, 'a0000000-0000-4000-8000-000000000003'),
  -- Remis au fournisseur, pas encore débité (le relevé montre un montant différent)
  ('10000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'check', 'delivered',
   'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1002,
   'e0000000-0000-4000-8000-000000000001', 'SOTRAMA MATERIAUX', 15600.00, '2026-10-08', 'Casablanca', null, '2026-10-09', null,
   null, 'a0000000-0000-4000-8000-000000000003'),
  -- Émis, en circulation
  ('10000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'check', 'issued',
   'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1003,
   'e0000000-0000-4000-8000-000000000003', 'ATLAS TRANSPORT ET LOGISTIQUE', 8450.50, '2026-10-14', 'Casablanca', null, null, null,
   null, 'a0000000-0000-4000-8000-000000000003'),
  -- Chèque gâché : le numéro reste dans l'historique avec son motif
  ('10000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'check', 'cancelled',
   'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1004,
   'e0000000-0000-4000-8000-000000000004', 'CENTRALE AGRO DISTRIBUTION', 12000.00, '2026-10-16', 'Casablanca', null, null, null,
   'Erreur d''impression (décalage)', 'a0000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'check', 'issued',
   'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 1005,
   'e0000000-0000-4000-8000-000000000004', 'CENTRALE AGRO DISTRIBUTION', 12000.00, '2026-10-16', 'Casablanca', null, null, null,
   null, 'a0000000-0000-4000-8000-000000000003'),
  -- Facture ME/26/1187 réglée en trois LCN échelonnées à 30/120/150 jours
  ('10000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'lcn', 'paid',
   'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 5000100,
   'e0000000-0000-4000-8000-000000000002', 'MAGHREB EMBALLAGES', 40000.00, '2026-07-21', 'Casablanca', '2026-08-20', '2026-07-22', '2026-08-20',
   null, 'a0000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', 'lcn', 'delivered',
   'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 5000101,
   'e0000000-0000-4000-8000-000000000002', 'MAGHREB EMBALLAGES', 40000.00, '2026-07-21', 'Casablanca', '2026-11-18', '2026-07-22', null,
   null, 'a0000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', 'lcn', 'delivered',
   'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 5000102,
   'e0000000-0000-4000-8000-000000000002', 'MAGHREB EMBALLAGES', 40000.00, '2026-07-21', 'Casablanca', '2026-12-18', '2026-07-22', null,
   null, 'a0000000-0000-4000-8000-000000000002');

insert into public.payment_allocations (organization_id, payment_id, invoice_id, amount) values
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 24000.00),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 24000.00),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 15600.00),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000004', 8450.50),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000006', 12000.00),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000003', 40000.00),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-000000000003', 40000.00),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'f0000000-0000-4000-8000-000000000003', 40000.00);

-- -----------------------------------------------------------------------------
-- Extrait bancaire d'exemple (Attijariwafa, octobre 2026)
-- Le fichier CSV correspondant est dans supabase/seed-files/releve-awb-2026-10.csv
-- -----------------------------------------------------------------------------

insert into public.statement_imports (id, organization_id, bank_account_id, period_start, period_end,
  file_path, file_hash, format, status, line_count, imported_by) values
  ('20000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '2026-10-01', '2026-10-31', null, 'demo-releve-awb-2026-10', 'csv', 'review', 6, 'a0000000-0000-4000-8000-000000000002');

insert into public.statement_lines (organization_id, import_id, bank_account_id, operation_date, value_date,
  label, debit, credit, extracted_number, matched_payment_id, confidence, status, line_hash) values
  -- Exact : numéro + montant identiques
  ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '2026-10-03', '2026-10-03', 'CHQ 0001000 SOTRAMA', 24000.00, null, 1000, '10000000-0000-4000-8000-000000000001', 100, 'auto_matched', 'demo-1'),
  ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '2026-10-06', '2026-10-06', 'PAIEMENT CHEQUE N°1001', 24000.00, null, 1001, '10000000-0000-4000-8000-000000000002', 100, 'auto_matched', 'demo-2'),
  -- Non rapprochée : frais bancaires
  ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '2026-10-08', '2026-10-08', 'FRAIS TENUE DE COMPTE', 45.00, null, null, null, null, 'unmatched', 'demo-3'),
  -- Probable : numéro identique mais montant différent (15 060 au lieu de 15 600)
  ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '2026-10-15', '2026-10-15', 'CHEQUE 1002', 15060.00, null, 1002, '10000000-0000-4000-8000-000000000003', 60, 'to_confirm', 'demo-4'),
  -- Chèque débité inconnu (numéro hors des paiements enregistrés)
  ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '2026-10-20', '2026-10-20', 'CHQ 0001017', 3200.00, null, 1017, null, null, 'unmatched', 'demo-5'),
  ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '2026-10-22', '2026-10-22', 'VIREMENT RECU CLIENT MARJANE', null, 50000.00, null, null, null, 'unmatched', 'demo-6');
