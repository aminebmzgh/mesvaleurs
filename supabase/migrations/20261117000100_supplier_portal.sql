-- =============================================================================
-- Portail fournisseur (#48) : lien secret, sans compte, en lecture seule, où un
-- fournisseur suit les règlements émis à son nom (statut, factures réglées) et ses
-- factures encore ouvertes. Un lien par fournisseur, valable jusqu'à sa désactivation
-- ou son renouvellement. Offre Pro et plus (comme l'accusé de réception).
-- =============================================================================

create table public.supplier_portal_links (
  -- Identifiant propre (référence de la ligne dans le journal d'audit)
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null unique references public.suppliers (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- 32 caractères base64url (192 bits) : impossible à deviner
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{32}$'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  -- Dernière consultation par le fournisseur (sans trace dans le journal d'audit)
  last_viewed_at timestamptz,
  view_count integer not null default 0
);

create index supplier_portal_links_organization_idx on public.supplier_portal_links (organization_id);

-- Création, renouvellement et désactivation dans le journal ; les consultations n'y figurent pas
create trigger supplier_portal_links_audit
  after insert or delete or update of token on public.supplier_portal_links
  for each row execute function private.audit_row_change();

alter table public.supplier_portal_links enable row level security;

create policy "supplier_portal_links_select" on public.supplier_portal_links
  for select to authenticated
  using (organization_id in (select private.member_org_ids()));

-- Écritures uniquement par les fonctions ci-dessous
revoke all on public.supplier_portal_links from anon, authenticated;
grant select on public.supplier_portal_links to authenticated;

-- Offre comprenant le portail (cf. FEATURES.supplier_portal dans src/lib/billing/plans.ts)
create or replace function private.has_supplier_portal(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.effective_plan(p_organization_id) in ('pro', 'business', 'cabinet');
$$;

-- Nouveau lien (ou premier) : l'ancien cesse aussitôt de fonctionner. Direction et gestion des comptes.
create or replace function public.renew_supplier_portal(p_supplier_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
  new_token text;
begin
  select organization_id into org from public.suppliers where id = p_supplier_id;
  if org is null or not private.has_role(org, array['admin', 'manager']::public.app_role[]) then
    raise exception 'Action réservée aux administrateurs et gestionnaires.' using errcode = 'P0002';
  end if;
  if not private.has_supplier_portal(org) then
    raise exception 'Portail fournisseur : fonctionnalité de l''offre Pro.' using errcode = 'P0001';
  end if;
  new_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  insert into public.supplier_portal_links (supplier_id, organization_id, token, created_by)
  values (p_supplier_id, org, new_token, auth.uid())
  on conflict (supplier_id) do update
    set token = excluded.token, created_at = now(), created_by = excluded.created_by, last_viewed_at = null, view_count = 0;
  return new_token;
end;
$$;

-- Désactivation : le lien ne fonctionne plus
create or replace function public.revoke_supplier_portal(p_supplier_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select organization_id into org from public.suppliers where id = p_supplier_id;
  if org is null or not private.has_role(org, array['admin', 'manager']::public.app_role[]) then
    raise exception 'Action réservée aux administrateurs et gestionnaires.' using errcode = 'P0002';
  end if;
  delete from public.supplier_portal_links where supplier_id = p_supplier_id;
end;
$$;

-- Page publique du portail : tout ce que voit le fournisseur, ou null (lien inconnu,
-- désactivé, ou offre ne comprenant plus le portail). Seules données exposées : celles
-- qui le concernent, sans compte bancaire ni note interne.
create or replace function public.get_supplier_portal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link public.supplier_portal_links;
  result jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32}$' then
    return null;
  end if;
  select * into link from public.supplier_portal_links where token = p_token;
  if not found or not private.has_supplier_portal(link.organization_id) then
    return null;
  end if;

  -- Consultation comptée (une fois par minute au plus, pour ne pas écrire à chaque rafraîchissement)
  if link.last_viewed_at is null or link.last_viewed_at < now() - interval '1 minute' then
    update public.supplier_portal_links
    set last_viewed_at = now(), view_count = view_count + 1
    where supplier_id = link.supplier_id;
  end if;

  select jsonb_build_object(
    'organization', (
      select jsonb_build_object('name', o.name, 'city', o.city, 'phone', o.phone, 'email', o.email)
      from public.organizations o where o.id = link.organization_id
    ),
    'supplier', (select jsonb_build_object('name', s.name) from public.suppliers s where s.id = link.supplier_id),
    -- Règlements remis ou à remettre (ni brouillons, ni annulés, ni chèques de garantie), 200 au plus
    'payments', coalesce((
      select jsonb_agg(p.item order by p.issue_date desc, p.created_at desc)
      from (
        select pay.issue_date, pay.created_at, jsonb_build_object(
          'id', pay.id,
          'type', pay.type,
          'status', pay.status,
          'number', pay.number,
          'reference', pay.reference,
          'amount', pay.amount,
          'issueDate', pay.issue_date,
          'dueDate', pay.due_date,
          'deliveredAt', pay.delivered_at,
          'debitedAt', pay.debited_at,
          'rejectedAt', pay.rejected_at,
          'regularizedAt', pay.regularized_at,
          'bank', (select b.name from public.bank_accounts ba join public.banks b on b.id = ba.bank_id where ba.id = pay.bank_account_id),
          'invoices', coalesce((
            select jsonb_agg(jsonb_build_object('number', i.number, 'amount', a.amount) order by i.issue_date, i.number)
            from public.payment_allocations a join public.invoices i on i.id = a.invoice_id
            where a.payment_id = pay.id
          ), '[]'::jsonb)
        ) as item
        from public.payments pay
        where pay.supplier_id = link.supplier_id
          and pay.organization_id = link.organization_id
          and pay.status in ('issued', 'delivered', 'paid', 'rejected')
          and pay.type <> 'guarantee_check'
        order by pay.issue_date desc, pay.created_at desc
        limit 200
      ) p
    ), '[]'::jsonb),
    -- Factures pas encore entièrement réglées (contestées comprises, signalées)
    'openInvoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'number', i.number,
        'issueDate', i.issue_date,
        'dueDate', i.legal_due_date,
        'amountInclTax', i.amount_incl_tax,
        'amountPaid', i.amount_paid,
        'disputed', i.status = 'disputed'
      ) order by coalesce(i.legal_due_date, i.issue_date), i.number)
      from public.invoices i
      where i.supplier_id = link.supplier_id
        and i.organization_id = link.organization_id
        and i.status in ('unpaid', 'partially_paid', 'disputed')
        and i.amount_incl_tax > i.amount_paid
    ), '[]'::jsonb),
    'generatedAt', now()
  ) into result;
  return result;
end;
$$;

revoke execute on function private.has_supplier_portal(uuid) from public, anon, authenticated;
revoke execute on function public.renew_supplier_portal(uuid) from public, anon;
revoke execute on function public.revoke_supplier_portal(uuid) from public, anon;
revoke execute on function public.get_supplier_portal(text) from public;
grant execute on function public.renew_supplier_portal(uuid) to authenticated;
grant execute on function public.revoke_supplier_portal(uuid) to authenticated;
-- Le portail est public : seul le jeton y donne accès
grant execute on function public.get_supplier_portal(text) to anon, authenticated;
