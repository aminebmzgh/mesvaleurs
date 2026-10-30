import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { todayIso } from "@/lib/dates";
import { getPaymentToReplace, getTransferFormData } from "@/lib/payments/queries";
import { TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "Nouveau virement" };

export default function NewTransferPage({ searchParams }: PageProps<"/paiements/virement">) {
  return (
    <>
      <PageHeader
        title="Nouveau virement"
        description="Enregistrez un virement fournisseur et les factures qu'il règle. Rien n'est imprimé."
      />
      <Suspense fallback={<Skeleton className="h-128 w-full rounded-xl" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/paiements/virement">, "searchParams">) {
  await requireRole(WRITER_ROLES);
  const { remplace } = await searchParams;
  const [data, replacing] = await Promise.all([getTransferFormData(), getPaymentToReplace(typeof remplace === "string" ? remplace : undefined)]);
  return <TransferForm data={data} today={todayIso()} replacing={replacing} />;
}
