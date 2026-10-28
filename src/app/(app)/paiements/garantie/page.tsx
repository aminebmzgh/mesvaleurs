import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { todayIso } from "@/lib/dates";
import { getAssistantData } from "@/lib/payments/queries";
import { GuaranteeForm } from "./guarantee-form";

export const metadata: Metadata = { title: "Nouveau chèque de garantie" };

export default function NewGuaranteePage() {
  return (
    <>
      <PageHeader
        title="Nouveau chèque de garantie"
        description="Chèque remis à un fournisseur sans intention d'encaissement : il ne règle aucune facture et reste suivi jusqu'à sa restitution."
      />
      <Suspense fallback={<Skeleton className="h-128 w-full rounded-xl" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await requireRole(WRITER_ROLES);
  const data = await getAssistantData();
  return <GuaranteeForm data={data} today={todayIso()} />;
}
