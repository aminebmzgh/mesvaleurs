import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { todayIso } from "@/lib/dates";
import { getAssistantData } from "@/lib/payments/queries";
import { PaymentAssistant } from "./payment-assistant";

export const metadata: Metadata = { title: "Nouveau paiement" };

export default function NewPaymentPage() {
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
      <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-xl" />}>
        <Assistant />
      </Suspense>
    </>
  );
}

async function Assistant() {
  await requireRole(WRITER_ROLES);
  const data = await getAssistantData();
  return <PaymentAssistant data={data} today={todayIso()} />;
}
