import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { todayIso } from "@/lib/dates";
import { getTransferFormData } from "@/lib/payments/queries";
import { TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "Nouveau virement" };

export default function NewTransferPage() {
  return (
    <>
      <PageHeader
        title="Nouveau virement"
        description="Enregistrez un virement fournisseur et les factures qu'il règle. Rien n'est imprimé."
      />
      <Suspense fallback={<Skeleton className="h-128 w-full rounded-xl" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await requireRole(WRITER_ROLES);
  const data = await getTransferFormData();
  return <TransferForm data={data} today={todayIso()} />;
}
