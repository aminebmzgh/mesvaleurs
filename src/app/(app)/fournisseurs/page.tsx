import { PlusIcon, SearchIcon, TruckIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { ExportLinks } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { formatMAD } from "@/lib/format";
import { listSuppliers } from "@/lib/suppliers/queries";

export const metadata: Metadata = { title: "Fournisseurs" };

type SearchParams = PageProps<"/fournisseurs">["searchParams"];

export default function SuppliersPage({ searchParams }: PageProps<"/fournisseurs">) {
  return (
    <>
      <PageHeader
        title="Fournisseurs"
        description="Fiches fournisseurs, solde dû et paiements en circulation."
        actions={
          <Suspense>
            <NewSupplierButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <SupplierList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewSupplierButton() {
  const organization = await requireActiveOrganization();
  if (!WRITER_ROLES.includes(organization.role)) {
    return null;
  }
  return (
    <Link href="/fournisseurs/nouveau" className={buttonVariants()}>
      <PlusIcon aria-hidden />
      Nouveau fournisseur
    </Link>
  );
}

async function SupplierList({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const archived = params.archives === "1";
  const { suppliers, truncated } = await listSuppliers({ search, archived });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Form action="/fournisseurs" className="flex w-full max-w-md gap-2" role="search">
            <Input type="search" name="q" defaultValue={search} placeholder="Raison sociale, nom imprimé ou ICE" aria-label="Rechercher un fournisseur" />
            {archived && <input type="hidden" name="archives" value="1" />}
            <Button type="submit" variant="outline" aria-label="Rechercher">
              <SearchIcon aria-hidden />
            </Button>
          </Form>
          <Link
            href={archived ? "/fournisseurs" : "/fournisseurs?archives=1"}
            className={buttonVariants({ variant: "link", size: "sm" })}
          >
            {archived ? "Voir les fournisseurs actifs" : "Voir les fournisseurs archivés"}
          </Link>
        </div>
        <ExportLinks list="fournisseurs" params={{ q: search, archives: archived ? "1" : undefined }} />

        {suppliers.length === 0 ? (
          <EmptyState
            icon={TruckIcon}
            title={search ? "Aucun fournisseur trouvé" : archived ? "Aucun fournisseur archivé" : "Aucun fournisseur"}
            description={
              search
                ? `Aucun fournisseur ne correspond à « ${search} ».`
                : "Enregistrez vos fournisseurs pour leur rattacher factures et paiements."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raison sociale</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>ICE</TableHead>
                  <TableHead className="text-end">Délai</TableHead>
                  <TableHead className="text-end">Factures ouvertes</TableHead>
                  <TableHead className="text-end">Reste à payer</TableHead>
                  <TableHead className="text-end">En circulation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      <Link href={`/fournisseurs/${supplier.id}`} className="hover:underline">
                        {supplier.name}
                      </Link>
                    </TableCell>
                    <TableCell>{supplier.city ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{supplier.ice ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {supplier.payment_terms_days != null ? `${supplier.payment_terms_days} j` : "—"}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{supplier.summary?.open_invoice_count ?? 0}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMAD(supplier.summary?.amount_due ?? 0)}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatMAD(supplier.summary?.amount_in_circulation ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {truncated && (
          <p className="text-xs text-muted-foreground">
            Seuls les 200 premiers résultats sont affichés : affinez la recherche.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
