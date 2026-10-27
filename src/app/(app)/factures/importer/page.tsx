import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { InvoiceImport } from "./invoice-import";

export const metadata: Metadata = { title: "Importer des factures" };

export default function ImportInvoicesPage() {
  return (
    <>
      <Link href="/factures" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Factures
      </Link>
      <PageHeader
        title="Importer des factures"
        description="Depuis un export Excel ou CSV de votre logiciel de gestion ou de votre tableur."
      />
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <Import />
      </Suspense>
    </>
  );
}

async function Import() {
  await requireRole(WRITER_ROLES);
  return <InvoiceImport />;
}
