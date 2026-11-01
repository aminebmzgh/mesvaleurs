import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { UblImport } from "./ubl-import";

export const metadata: Metadata = { title: "Factures électroniques UBL" };

export default function UblPage() {
  return (
    <>
      <Link href="/factures" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Factures
      </Link>
      <PageHeader
        title="Factures électroniques UBL"
        description="Import des factures électroniques reçues au format UBL (XML) : fournisseur, numéro, dates et montants repris sans ressaisie, après contrôle de l'ICE, du numéro et des totaux."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Import />
      </Suspense>
    </>
  );
}

async function Import() {
  const organization = await requireRole(WRITER_ROLES);
  return <UblImport organizationId={organization.organizationId} />;
}
