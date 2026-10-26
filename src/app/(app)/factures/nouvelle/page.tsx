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
  return (
    <Card className="max-w-3xl">
      <CardContent>
        <InvoiceForm
          action={createInvoice}
          suppliers={suppliers}
          defaultSupplierId={suppliers.some((s) => s.value === defaultSupplierId) ? defaultSupplierId : undefined}
          submitLabel="Enregistrer la facture"
        />
      </CardContent>
    </Card>
  );
}
