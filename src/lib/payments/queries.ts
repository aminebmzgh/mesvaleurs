import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import type { StoppedRange } from "@/lib/checkbooks";
import { paymentLabel } from "@/lib/payments/label";
import { createClient } from "@/lib/supabase/server";

export type AssistantCheckbook = {
  id: string;
  type: "check" | "lcn";
  nextNumber: number;
  lastNumber: number;
  numberWidth: number;
  /** Formules vierges en opposition, sautées à l'émission. */
  stoppedRanges: StoppedRange[];
  bankAccountId: string;
  accountLabel: string;
  bankName: string;
  /** Solde courant − paiements émis non débités : base de l'alerte de provision. */
  availableBalance: number;
};

export type OpenInvoice = {
  id: string;
  number: string;
  issueDate: string;
  legalDueDate: string | null;
  amountInclTax: number;
  amountPaid: number;
};

/** Données de l'assistant de paiement : carnets en service, fournisseurs, entreprise. */
export async function getAssistantData() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;

  const [checkbooks, circulation, suppliers, org] = await Promise.all([
    supabase
      .from("checkbooks")
      .select(
        "id, type, next_number, last_number, number_width, stop_orders ( first_number, last_number, payment_id ), bank_accounts!inner ( id, label, current_balance, is_active, banks ( name ) )",
      )
      .eq("organization_id", orgId)
      .eq("status", "active")
      .eq("bank_accounts.is_active", true)
      .order("type")
      .order("first_number"),
    supabase
      .from("payments")
      .select("bank_account_id, amount")
      .eq("organization_id", orgId)
      .in("status", ["issued", "delivered"])
      .neq("type", "guarantee_check"),
    supabase
      .from("suppliers")
      .select("id, name, payee_name, print_cover_letter")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name"),
    supabase.from("organizations").select("city").eq("id", orgId).single(),
  ]);
  const error = checkbooks.error ?? circulation.error ?? suppliers.error ?? org.error;
  if (error) {
    throw new Error("Impossible de charger l'assistant de paiement.", { cause: error });
  }

  const inCirculation = new Map<string, number>();
  for (const payment of circulation.data ?? []) {
    inCirculation.set(payment.bank_account_id, (inCirculation.get(payment.bank_account_id) ?? 0) + payment.amount);
  }

  return {
    organizationId: orgId,
    city: org.data?.city ?? "",
    amountWordsRectified: organization.amountWordsRectified,
    checkbooks: (checkbooks.data ?? []).map(
      (book): AssistantCheckbook => ({
        id: book.id,
        type: book.type,
        nextNumber: book.next_number,
        lastNumber: book.last_number,
        numberWidth: book.number_width,
        stoppedRanges: book.stop_orders.filter((s) => s.payment_id === null).map((s): StoppedRange => [s.first_number, s.last_number]),
        bankAccountId: book.bank_accounts.id,
        accountLabel: book.bank_accounts.label,
        bankName: book.bank_accounts.banks?.name ?? "",
        availableBalance: book.bank_accounts.current_balance - (inCirculation.get(book.bank_accounts.id) ?? 0),
      }),
    ),
    suppliers: (suppliers.data ?? []).map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      payeeName: supplier.payee_name || supplier.name,
      printCoverLetter: supplier.print_cover_letter,
    })),
  };
}

export type AssistantData = Awaited<ReturnType<typeof getAssistantData>>;

/** Factures non soldées et non contestées d'un fournisseur, les plus anciennes d'abord. */
export async function listOpenInvoices(supplierId: string): Promise<OpenInvoice[]> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, number, issue_date, legal_due_date, amount_incl_tax, amount_paid")
    .eq("organization_id", organization.organizationId)
    .eq("supplier_id", supplierId)
    .in("status", ["unpaid", "partially_paid"])
    .order("issue_date")
    .order("number");
  if (error) {
    throw new Error("Impossible de charger les factures.", { cause: error });
  }
  return data.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    issueDate: invoice.issue_date,
    legalDueDate: invoice.legal_due_date,
    amountInclTax: invoice.amount_incl_tax,
    amountPaid: invoice.amount_paid,
  }));
}

/** Données du formulaire de virement : comptes en service et fournisseurs actifs. */
export async function getTransferFormData() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;
  const [accounts, suppliers] = await Promise.all([
    supabase.from("bank_accounts").select("id, label, banks ( name )").eq("organization_id", orgId).eq("is_active", true).order("label"),
    supabase.from("suppliers").select("id, name").eq("organization_id", orgId).eq("is_active", true).order("name"),
  ]);
  const error = accounts.error ?? suppliers.error;
  if (error) {
    throw new Error("Impossible de charger le formulaire de virement.", { cause: error });
  }
  return {
    accounts: (accounts.data ?? []).map((account) => ({ id: account.id, label: account.label, bankName: account.banks?.name ?? "" })),
    suppliers: suppliers.data ?? [],
  };
}

export type TransferFormData = Awaited<ReturnType<typeof getTransferFormData>>;

export type ReplacedPayment = { id: string; label: string; supplierId: string; amount: number; invoiceIds: string[] };

/** Paiement rejeté, non régularisé, à remplacer (nouveau chèque, LCN ou virement). */
export async function getPaymentToReplace(paymentId: string | undefined): Promise<ReplacedPayment | null> {
  if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) {
    return null;
  }
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, type, number, reference, amount, supplier_id, checkbooks ( number_width ), payment_allocations ( invoice_id )")
    .eq("organization_id", organization.organizationId)
    .eq("id", paymentId)
    .eq("status", "rejected")
    .is("regularized_at", null)
    .maybeSingle();
  if (!data) {
    return null;
  }
  return {
    id: data.id,
    label: paymentLabel(data),
    supplierId: data.supplier_id,
    amount: data.amount,
    invoiceIds: data.payment_allocations.map((allocation) => allocation.invoice_id),
  };
}
