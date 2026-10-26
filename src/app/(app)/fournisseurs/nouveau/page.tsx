import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { createSupplier } from "../actions";
import { SupplierForm } from "../supplier-form";

export const metadata: Metadata = { title: "Nouveau fournisseur" };

export default function NewSupplierPage() {
  return (
    <>
      <PageHeader title="Nouveau fournisseur" />
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl rounded-xl" />}>
        <NewSupplier />
      </Suspense>
    </>
  );
}

async function NewSupplier() {
  await requireRole(WRITER_ROLES);
  return (
    <Card className="max-w-3xl">
      <CardContent>
        <SupplierForm action={createSupplier} submitLabel="Créer le fournisseur" />
      </CardContent>
    </Card>
  );
}
