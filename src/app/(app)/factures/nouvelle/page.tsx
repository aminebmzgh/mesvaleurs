import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { getAiStatus } from "@/lib/ai/usage";
import { listSupplierOptions } from "@/lib/invoices/queries";
import { createClient } from "@/lib/supabase/server";
import { createInvoice } from "../actions";
import { AiInvoiceEntry } from "./ai-invoice-entry";

export const metadata: Metadata = { title: "Nouvelle facture" };

export default function NewInvoicePage({ searchParams }: PageProps<"/factures/nouvelle">) {
  return (
    <>
      <PageHeader title="Nouvelle facture" />
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl rounded-xl" />}>
        <NewInvoice searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewInvoice({ searchParams }: Pick<PageProps<"/factures/nouvelle">, "searchParams">) {
  const organization = await requireRole(WRITER_ROLES);
  const [params, suppliers, ai] = await Promise.all([
    searchParams,
    listSupplierOptions(),
    createClient().then((supabase) => getAiStatus(supabase, organization.organizationId)),
  ]);
  const defaultSupplierId = typeof params.fournisseur === "string" ? params.fournisseur : undefined;
  const supplierId = suppliers.some((s) => s.value === defaultSupplierId) ? defaultSupplierId : undefined;
  // Facture pré-remplie (rapprochement avec le relevé du fournisseur) : numéro, date, TTC
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const total = Number(text(params.ttc));
  const prefill =
    supplierId && text(params.numero)
      ? {
          supplier_id: supplierId,
          number: text(params.numero).slice(0, 60),
          ...(/^\d{4}-\d{2}-\d{2}$/.test(text(params.date)) && { issue_date: text(params.date) }),
          ...(Number.isFinite(total) && total > 0 && { amount_incl_tax: total }),
        }
      : undefined;
  return (
    <AiInvoiceEntry
      action={createInvoice}
      suppliers={suppliers}
      prefill={prefill}
      defaultSupplierId={supplierId}
      organizationId={organization.organizationId}
      // Sans clé du service sur le serveur : rien n'est proposé
      ai={ai.configured ? { included: ai.included, enabled: ai.enabled, quota: ai.quota, used: ai.used } : null}
      isAdmin={organization.role === "admin"}
    />
  );
}
