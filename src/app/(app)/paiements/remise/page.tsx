import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { getDeliverablePayments } from "@/lib/receipts/queries";
import { ReceiptSigning } from "./receipt-signing";

export const metadata: Metadata = { title: "Remise signée" };

const UUID = /^[0-9a-f-]{36}$/i;

export default function ReceiptPage({ searchParams }: PageProps<"/paiements/remise">) {
  return (
    <>
      <Link href="/paiements" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Chèques et LCN
      </Link>
      <PageHeader
        title="Remise signée"
        description="Le fournisseur ou son livreur signe à l'écran à la réception des chèques et LCN : un accusé de réception numéroté est établi, avec son reçu PDF."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl rounded-xl" />}>
        <Signing searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Signing({ searchParams }: Pick<PageProps<"/paiements/remise">, "searchParams">) {
  await requireRole(WRITER_ROLES);
  const { lot, paiement } = await searchParams;
  const batchId = typeof lot === "string" && UUID.test(lot) ? lot : undefined;
  const paymentId = typeof paiement === "string" && UUID.test(paiement) ? paiement : undefined;
  const data = batchId || paymentId ? await getDeliverablePayments({ batchId, paymentId }) : null;
  if (!data || data.payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune valeur à remettre : les chèques et LCN concernés sont déjà remis avec un accusé signé, débités ou annulés.{" "}
        <Link href="/paiements/accuses" className="underline">
          Voir les accusés de réception
        </Link>
      </p>
    );
  }
  return <ReceiptSigning organizationId={data.organizationId} supplierName={data.supplier.name} payments={data.payments} selected={data.selected} />;
}
