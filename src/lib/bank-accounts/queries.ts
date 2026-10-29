import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/** Banques proposées : référentiel commun et banques ajoutées par l'organisation. */
export async function listBanks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banks")
    .select("id, name, short_name")
    .eq("is_active", true)
    .order("name");
  if (error) {
    throw new Error("Impossible de charger les banques.", { cause: error });
  }
  return data;
}

/** Comptes de l'organisation active, avec leur banque et la synthèse de leurs carnets. */
export async function listBankAccounts() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const [accounts, checkbooks] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select("id, label, branch, rib, currency, opening_balance, current_balance, is_active, banks ( name )")
      .eq("organization_id", organization.organizationId)
      .order("is_active", { ascending: false })
      .order("label"),
    supabase
      .from("checkbook_summaries")
      .select("bank_account_id, type, status, remaining_count")
      .eq("organization_id", organization.organizationId),
  ]);
  if (accounts.error || checkbooks.error) {
    throw new Error("Impossible de charger les comptes bancaires.", {
      cause: accounts.error ?? checkbooks.error,
    });
  }
  return accounts.data.map((account) => ({
    ...account,
    checkbooks: checkbooks.data.filter((c) => c.bank_account_id === account.id),
  }));
}

/** Détail d'un compte et de ses carnets (null s'il n'existe pas ou n'est pas visible). */
export async function getBankAccount(id: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const [account, checkbooks] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select(
        "id, bank_id, label, branch, rib, currency, opening_balance, opening_balance_date, current_balance, is_active, banks ( name )",
      )
      .eq("organization_id", organization.organizationId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("checkbook_summaries")
      .select("*")
      .eq("organization_id", organization.organizationId)
      .eq("bank_account_id", id)
      .order("type")
      .order("first_number"),
  ]);
  if (account.error || checkbooks.error) {
    throw new Error("Impossible de charger le compte bancaire.", {
      cause: account.error ?? checkbooks.error,
    });
  }
  if (!account.data) {
    return null;
  }
  return { ...account.data, checkbooks: checkbooks.data };
}

/** Oppositions d'un compte (paiements émis et formules vierges), les plus récentes d'abord. */
export async function listStopOrders(bankAccountId: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stop_orders")
    .select(
      "id, reason, occurred_on, declared_on, police_report, first_number, last_number, payment_id, checkbooks ( type, number_width ), payments ( type, amount, payee_name )",
    )
    .eq("organization_id", organization.organizationId)
    .eq("bank_account_id", bankAccountId)
    .order("declared_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error("Impossible de charger les oppositions.", { cause: error });
  }
  return data;
}
