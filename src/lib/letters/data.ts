import "server-only";
import { toCents } from "@/lib/amount";
import { requireActiveOrganization, requireUser } from "@/lib/auth/dal";
import { paymentLabel } from "@/lib/payments/label";
import { createClient } from "@/lib/supabase/server";
import { settlementReference } from "./reference";

export type LetterInvoice = { number: string; issueDate: string; amountInclTax: number; settled: number; remaining: number };
export type LetterInstrument = { label: string; bank: string; amount: number; dueDate: string | null };

export type LetterOrganization = {
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  ice: string | null;
  taxId: string | null;
  tradeRegister: string | null;
  logo: { bytes: Uint8Array; type: "png" | "jpg" } | null;
};
export type LetterSigner = { name: string; jobTitle: string | null };

export type CoverLetterData = {
  organization: LetterOrganization;
  supplier: { name: string; address: string | null; city: string | null; ice: string | null };
  signer: LetterSigner;
  place: string;
  issueDate: string;
  reference: string;
  invoices: LetterInvoice[];
  instruments: LetterInstrument[];
  total: number;
  remaining: number;
  hasLcn: boolean;
  printCoverLetter: boolean;
};

/** En-tête des courriers : identité de l'entreprise active (avec son logo) et signataire (l'utilisateur). */
export async function getLetterhead(): Promise<{ organization: LetterOrganization; signer: LetterSigner }> {
  const organization = await requireActiveOrganization();
  const user = await requireUser();
  const supabase = await createClient();
  const [org, profile] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, address, city, phone, email, ice, tax_id, trade_register, logo_path")
      .eq("id", organization.organizationId)
      .single(),
    supabase.from("profiles").select("full_name, job_title").eq("id", user.id).maybeSingle(),
  ]);
  if (org.error) {
    throw new Error("Impossible de préparer la lettre.", { cause: org.error });
  }

  let logo: LetterOrganization["logo"] = null;
  if (org.data.logo_path) {
    const { data: file } = await supabase.storage.from("logos").download(org.data.logo_path);
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      logo = { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type === "image/png" ? "png" : "jpg" };
    }
  }
  return {
    organization: {
      name: org.data.name,
      address: org.data.address,
      city: org.data.city,
      phone: org.data.phone,
      email: org.data.email,
      ice: org.data.ice,
      taxId: org.data.tax_id,
      tradeRegister: org.data.trade_register,
      logo,
    },
    signer: { name: profile.data?.full_name || user.fullName || user.email, jobTitle: profile.data?.job_title ?? null },
  };
}

/** Données de la lettre d'accompagnement et du bordereau d'un lot. */
export async function getCoverLetterData(batchId: string): Promise<CoverLetterData | null> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;

  const [letterhead, payments] = await Promise.all([
    getLetterhead(),
    supabase
      .from("payments")
      .select(
        `id, type, status, number, reference, amount, issue_date, issue_place, due_date,
         checkbooks ( number_width ), bank_accounts ( banks ( name ) ),
         suppliers ( name, address, city, ice, print_cover_letter ),
         payment_allocations ( amount, invoices ( id, number, issue_date, amount_incl_tax, amount_paid ) )`,
      )
      .eq("organization_id", orgId)
      .eq("print_batch_id", batchId)
      // Ni annulés, ni en attente de validation (brouillons)
      .not("status", "in", "(cancelled,draft)")
      .order("number"),
  ]);
  if (payments.error) {
    throw new Error("Impossible de préparer la lettre.", { cause: payments.error });
  }
  const rows = payments.data ?? [];
  if (rows.length === 0 || !rows[0].suppliers) {
    return null;
  }

  // Factures réglées par le lot : montant réglé par ce lot, reste dû après règlement
  const invoices = new Map<string, LetterInvoice>();
  for (const payment of rows) {
    for (const allocation of payment.payment_allocations) {
      const invoice = allocation.invoices;
      if (!invoice) {
        continue;
      }
      const current = invoices.get(invoice.id);
      invoices.set(invoice.id, {
        number: invoice.number,
        issueDate: invoice.issue_date,
        amountInclTax: invoice.amount_incl_tax,
        settled: (current?.settled ?? 0) + allocation.amount,
        remaining: Math.max(toCents(invoice.amount_incl_tax) - toCents(invoice.amount_paid), 0) / 100,
      });
    }
  }

  const first = rows[0];
  const sortedInvoices = [...invoices.values()].sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number));
  return {
    organization: letterhead.organization,
    supplier: { name: first.suppliers!.name, address: first.suppliers!.address, city: first.suppliers!.city, ice: first.suppliers!.ice },
    signer: letterhead.signer,
    place: first.issue_place ?? letterhead.organization.city ?? "",
    issueDate: first.issue_date,
    reference: settlementReference(first.issue_date, first.number),
    invoices: sortedInvoices,
    instruments: rows.map((payment) => ({
      label: paymentLabel(payment),
      bank: payment.bank_accounts?.banks?.name ?? "",
      amount: payment.amount,
      dueDate: payment.due_date,
    })),
    total: rows.reduce((sum, payment) => sum + toCents(payment.amount), 0) / 100,
    remaining: sortedInvoices.reduce((sum, invoice) => sum + toCents(invoice.remaining), 0) / 100,
    hasLcn: rows.some((payment) => payment.type === "lcn"),
    printCoverLetter: first.suppliers!.print_cover_letter,
  };
}
