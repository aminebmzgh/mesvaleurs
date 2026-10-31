import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { todayIso } from "@/lib/dates";
import { getAssistantData, getPaymentToReplace } from "@/lib/payments/queries";
import { PaymentAssistant, type PaymentPrefill } from "./payment-assistant";

export const metadata: Metadata = { title: "Nouveau paiement" };

export default function NewPaymentPage({ searchParams }: PageProps<"/paiements/nouveau">) {
  return (
    <>
      <PageHeader
        title="Nouveau paiement"
        description="Préparez un ou plusieurs chèques ou LCN, rattachés aux factures qu'ils règlent."
        actions={
          <Link href="/paiements/virement" className={buttonVariants({ variant: "outline" })}>
            Payer par virement
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-160 w-full rounded-xl" />}>
        <Assistant searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Assistant({ searchParams }: Pick<PageProps<"/paiements/nouveau">, "searchParams">) {
  await requireRole(WRITER_ROLES);
  const { remplace, fournisseur, factures, mode, echeance } = await searchParams;
  const [data, replacing] = await Promise.all([getAssistantData(), getPaymentToReplace(typeof remplace === "string" ? remplace : undefined)]);
  // Plan de l'optimiseur : fournisseur, factures, chèque ou LCN et son échéance
  const uuid = /^[0-9a-f-]{36}$/i;
  const prefill: PaymentPrefill | null =
    typeof fournisseur === "string" && uuid.test(fournisseur)
      ? {
          supplierId: fournisseur,
          invoiceIds: typeof factures === "string" ? factures.split(",").filter((id) => uuid.test(id)) : [],
          type: mode === "lcn" ? "lcn" : "check",
          dueDate: typeof echeance === "string" && /^\d{4}-\d{2}-\d{2}$/.test(echeance) ? echeance : null,
        }
      : null;
  return <PaymentAssistant data={data} today={todayIso()} replacing={replacing} prefill={prefill} />;
}
