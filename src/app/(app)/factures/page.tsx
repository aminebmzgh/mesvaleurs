import { ArchiveIcon, FileCodeIcon, FileTextIcon, PaperclipIcon, PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FormSelect } from "@/components/form-select";
import { ExportLinks } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { todayIso } from "@/lib/dates";
import { formatDate, formatMAD } from "@/lib/format";
import { type InvoiceFilter, listInvoices, listSupplierOptions } from "@/lib/invoices/queries";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/labels";
import { InvoiceStatusBadge } from "./invoice-status";

export const metadata: Metadata = { title: "Factures" };

const STATUS_FILTERS: { value: InvoiceFilter; label: string }[] = [
  { value: "open", label: "À payer" },
  { value: "all", label: "Toutes" },
  ...(Object.entries(INVOICE_STATUS_LABELS) as [InvoiceStatus, string][]).map(([value, label]) => ({ value, label })),
];

export default function InvoicesPage({ searchParams }: PageProps<"/factures">) {
  return (
    <>
      <PageHeader
        title="Factures"
        description="Factures fournisseurs, montants réglés, encaissés et reste dû."
        actions={
          <Suspense>
            <NewInvoiceButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <InvoiceList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewInvoiceButton() {
  const organization = await requireActiveOrganization();
  return (
    <>
      <Link href="/factures/archives" className={buttonVariants({ variant: "outline" })}>
        <ArchiveIcon aria-hidden />
        Archives
      </Link>
      {WRITER_ROLES.includes(organization.role) && (
        <>
          <Link href="/factures/ubl" className={buttonVariants({ variant: "outline" })}>
            <FileCodeIcon aria-hidden />
            Factures UBL
          </Link>
          <Link href="/factures/importer" className={buttonVariants({ variant: "outline" })}>
            <UploadIcon aria-hidden />
            Importer
          </Link>
          <Link href="/factures/nouvelle" className={buttonVariants()}>
            <PlusIcon aria-hidden />
            Nouvelle facture
          </Link>
        </>
      )}
    </>
  );
}

async function InvoiceList({ searchParams }: Pick<PageProps<"/factures">, "searchParams">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : "";
  const status = STATUS_FILTERS.some((f) => f.value === params.statut) ? (params.statut as InvoiceFilter) : "open";
  const supplierId = typeof params.fournisseur === "string" && /^[0-9a-f-]{36}$/i.test(params.fournisseur)
    ? params.fournisseur
    : undefined;

  const [{ invoices, truncated }, suppliers] = await Promise.all([
    listInvoices({ search, status, supplierId }),
    listSupplierOptions(),
  ]);
  const today = todayIso();
  const totals = invoices.reduce(
    (sum, invoice) => ({
      ttc: sum.ttc + invoice.amount_incl_tax,
      paid: sum.paid + invoice.amount_paid,
      cashed: sum.cashed + invoice.amount_cashed,
    }),
    { ttc: 0, paid: 0, cashed: 0 },
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Form action="/factures" className="grid gap-2 sm:grid-cols-[1fr_14rem_14rem_auto]" role="search">
          <Input type="search" name="q" defaultValue={search} placeholder="Numéro de facture" aria-label="Rechercher par numéro" />
          <FormSelect
            name="fournisseur"
            options={[{ value: "tous", label: "Tous les fournisseurs" }, ...suppliers]}
            defaultValue={supplierId ?? "tous"}
          />
          <FormSelect name="statut" options={STATUS_FILTERS} defaultValue={status} />
          <Button type="submit" variant="outline">
            <SearchIcon aria-hidden />
            Filtrer
          </Button>
        </Form>
        <ExportLinks list="factures" params={{ q: search, statut: status, fournisseur: supplierId }} />

        {invoices.length === 0 ? (
          <EmptyState
            icon={FileTextIcon}
            title="Aucune facture"
            description={
              search || supplierId || status !== "open"
                ? "Aucune facture ne correspond à ces critères."
                : "Aucune facture à payer. Saisissez les factures de vos fournisseurs pour préparer leurs règlements."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Date limite</TableHead>
                  <TableHead className="text-end">TTC</TableHead>
                  <TableHead className="text-end">Réglé</TableHead>
                  <TableHead className="text-end">Encaissé</TableHead>
                  <TableHead className="text-end">Reste dû</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.suppliers?.name}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/factures/${invoice.id}`} className="inline-flex items-center gap-1 hover:underline">
                        {invoice.number}
                        {invoice.attachment_path && <PaperclipIcon className="size-3" aria-label="Pièce jointe" />}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                    <TableCell>{invoice.legal_due_date ? formatDate(invoice.legal_due_date) : "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMAD(invoice.amount_incl_tax)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMAD(invoice.amount_paid)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMAD(invoice.amount_cashed)}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatMAD(invoice.amount_incl_tax - invoice.amount_paid)}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} legalDueDate={invoice.legal_due_date} today={today} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total ({invoices.length})</TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(totals.ttc)}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(totals.paid)}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(totals.cashed)}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(totals.ttc - totals.paid)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
        {truncated && (
          <p className="text-xs text-muted-foreground">Seules les 300 factures les plus récentes sont affichées : affinez les filtres.</p>
        )}
      </CardContent>
    </Card>
  );
}
