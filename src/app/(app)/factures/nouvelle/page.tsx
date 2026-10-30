import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { listSupplierOptions } from "@/lib/invoices/queries";
import { createInvoice } from "../actions";
import { InvoiceForm } from "../invoice-form";

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
  await requireRole(WRITER_ROLES);
  const [params, suppliers] = await Promise.all([searchParams, listSupplierOptions()]);
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
    <Card className="max-w-3xl">
      <CardContent>
        <InvoiceForm
          action={createInvoice}
          suppliers={suppliers}
          invoice={prefill}
          defaultSupplierId={supplierId}
          submitLabel="Enregistrer la facture"
        />
      </CardContent>
    </Card>
  );
}
