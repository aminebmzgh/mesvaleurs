-- Trésorerie Générale du Royaume : tient des comptes et délivre des chéquiers
-- (organismes publics), un modèle de chèque par défaut lui est associé.
insert into public.banks (name, short_name) values
  ('Trésorerie Générale du Royaume', 'TGR')
on conflict do nothing;
