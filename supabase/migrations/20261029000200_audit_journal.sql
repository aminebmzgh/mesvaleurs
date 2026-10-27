-- =============================================================================
-- Journal d'audit complet : tables journalisées en plus, et vue de consultation
-- avec l'auteur de chaque action.
-- =============================================================================

-- Invitations, banques ajoutées par l'entreprise, relevés importés et correspondances
-- de colonnes : leurs modifications sont journalisées comme les autres tables métier.
do $$
declare
  t text;
begin
  foreach t in array array['invitations', 'banks', 'statement_imports', 'statement_column_mappings'] loop
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$I
         for each row execute function private.audit_row_change()', t);
  end loop;
end;
$$;

-- Consultation : les droits du journal s'appliquent (security_invoker), le nom de
-- l'auteur vient de son profil (visible des membres d'une même organisation).
create view public.audit_entries
with (security_invoker = true)
as
select
  a.id,
  a.organization_id,
  a.actor_id,
  p.full_name as actor_name,
  p.email as actor_email,
  a.action,
  a.table_name,
  a.record_id,
  a.before,
  a.after,
  a.details,
  a.created_at
from public.audit_log a
left join public.profiles p on p.id = a.actor_id;

revoke all on public.audit_entries from anon, public;
grant select on public.audit_entries to authenticated;

-- Filtre par table puis par date
create index audit_log_org_table_created_idx on public.audit_log (organization_id, table_name, created_at desc);
