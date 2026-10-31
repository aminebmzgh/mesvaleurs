import { ArchiveIcon, ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listArchives } from "@/lib/invoices/queries";
import { type ArchiveRow, ArchiveTable } from "./archive-table";

export const metadata: Metadata = { title: "Archives des factures" };

const isoDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

export default function ArchivesPage({ searchParams }: PageProps<"/factures/archives">) {
  return (
    <>
      <Link href="/factures" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Factures
      </Link>
      <PageHeader
        title="Archives des factures"
        description="Archivage légal : chaque pièce déposée (fichier UBL, PDF, photo) est conservée 10 ans, sans modification ni suppression possible. Son empreinte SHA-256 permet d'en vérifier l'intégrité."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Archives searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Archives({ searchParams }: Pick<PageProps<"/factures/archives">, "searchParams">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : undefined;
  const from = isoDate(params.du);
  const to = isoDate(params.au);
  const { archives, truncated } = await listArchives({ search, from, to });
  const rows: ArchiveRow[] = archives.flatMap((archive) =>
    archive.invoices
      ? [
          {
            id: archive.id,
            kind: archive.kind as ArchiveRow["kind"],
            sha256: archive.sha256,
            archivedAt: archive.archived_at,
            retainUntil: archive.retain_until,
            url: archive.url,
            invoice: {
              id: archive.invoices.id,
              number: archive.invoices.number,
              issueDate: archive.invoices.issue_date,
              amount: archive.invoices.amount_incl_tax,
              supplier: archive.invoices.suppliers?.name ?? "",
              ice: archive.invoices.suppliers?.ice ?? null,
            },
          },
        ]
      : [],
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Form action="/factures/archives" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Recherche
            <Input type="search" name="q" defaultValue={search} placeholder="N° de facture, fournisseur, ICE" className="w-72" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Facture du
            <Input type="date" name="du" defaultValue={from} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            au
            <Input type="date" name="au" defaultValue={to} />
          </label>
          <Button type="submit" variant="outline">
            Rechercher
          </Button>
        </Form>
        {rows.length === 0 ? (
          <EmptyState
            icon={ArchiveIcon}
            title="Aucune pièce archivée"
            description={search || from || to ? "Aucune archive ne correspond à la recherche." : "Les pièces jointes et factures UBL déposées apparaîtront ici."}
          />
        ) : (
          <>
            <ArchiveTable rows={rows} />
            {truncated && <p className="text-xs text-muted-foreground">Seules les 200 archives les plus récentes sont affichées : affinez la recherche.</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
