import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { paymentLabel } from "@/lib/payments/label";
import { getSupplier } from "@/lib/suppliers/queries";
import type { OurInvoice, OurPayment } from "@/lib/suppliers/statement-match";
import { SupplierReconciliation } from "./supplier-reconciliation";

export const metadata: Metadata = { title: "Rapprochement avec le relevé fournisseur" };

/** Paiements que le fournisseur peut avoir enregistrés (les garanties ne règlent rien). */
const SETTLING_STATUSES = new Set(["issued", "delivered", "paid"]);

export default function SupplierReconciliationPage({ params }: PageProps<"/fournisseurs/[id]/rapprochement">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Reconciliation params={params} />
    </Suspense>
  );
}

async function Reconciliation({ params }: Pick<PageProps<"/fournisseurs/[id]/rapprochement">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }
  const [organization, supplier] = await Promise.all([requireActiveOrganization(), getSupplier(id)]);
  if (!supplier) {
    notFound();
  }
  const invoices: OurInvoice[] = supplier.invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    issueDate: invoice.issue_date,
    amount: invoice.amount_incl_tax,
  }));
  const payments: OurPayment[] = supplier.payments
    .filter((payment) => payment.type !== "guarantee_check" && SETTLING_STATUSES.has(payment.status))
    .map((payment) => ({
      id: payment.id,
      label: paymentLabel(payment),
      number: payment.number,
      reference: payment.reference,
      date: payment.issue_date,
      amount: payment.amount,
      delivered: payment.status !== "issued",
    }));

  return (
    <>
      <Link href={`/fournisseurs/${supplier.id}`} className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        {supplier.name}
      </Link>
      <PageHeader
        title="Rapprochement avec le relevé du fournisseur"
        description={`Importez le relevé de compte envoyé par ${supplier.name} : ses factures et nos règlements sont comparés à nos livres. Rien n'est enregistré ; exportez le rapport pour le lui adresser.`}
      />
      <SupplierReconciliation
        supplierId={supplier.id}
        invoices={invoices}
        payments={payments}
        canCreateInvoice={WRITER_ROLES.includes(organization.role)}
      />
    </>
  );
}
