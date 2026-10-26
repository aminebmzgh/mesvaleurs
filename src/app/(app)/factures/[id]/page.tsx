import { ArrowLeftIcon, BanknoteIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { formatInstrumentNumber } from "@/lib/checkbooks";
import { daysBetween, todayIso } from "@/lib/dates";
import { formatDate, formatMAD } from "@/lib/format";
import { getInvoice, listSupplierOptions } from "@/lib/invoices/queries";
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, paymentStatusVariant } from "@/lib/labels";
import { updateInvoice } from "../actions";
import { InvoiceForm } from "../invoice-form";
import { InvoiceStatusBadge } from "../invoice-status";
import { AttachmentUpload } from "./attachment-upload";
import { InvoiceActions } from "./invoice-actions";

export const metadata: Metadata = { title: "Facture" };

export default function InvoicePage({ params }: PageProps<"/factures/[id]">) {
  return (
    <>
      <Link href="/factures" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Factures
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <InvoiceDetail params={params} />
      </Suspense>
    </>
  );
}

async function InvoiceDetail({ params }: Pick<PageProps<"/factures/[id]">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }
  const [organization, invoice, suppliers] = await Promise.all([
    requireActiveOrganization(),
    getInvoice(id),
    listSupplierOptions(),
  ]);
  if (!invoice) {
    notFound();
  }
  const canEdit = WRITER_ROLES.includes(organization.role);
  const canDelete = ["admin", "manager"].includes(organization.role) && invoice.allocations.length === 0;
  const today = todayIso();
  const remaining = invoice.amount_incl_tax - invoice.amount_paid;
  const daysLeft = invoice.legal_due_date ? daysBetween(today, invoice.legal_due_date) : null;
  const open = invoice.status === "unpaid" || invoice.status === "partially_paid";

  // Le fournisseur archivé reste proposé pour sa propre facture
  const supplierOptions = suppliers.some((s) => s.value === invoice.supplier_id)
    ? suppliers
    : [...suppliers, { value: invoice.supplier_id, label: invoice.suppliers?.name ?? "Fournisseur archivé" }];

  const amounts = [
    { label: "Montant TTC", value: invoice.amount_incl_tax },
    { label: "Réglé", value: invoice.amount_paid, hint: "Chèques et LCN émis" },
    { label: "Encaissé", value: invoice.amount_cashed, hint: "Débité en banque" },
    { label: "Reste dû", value: remaining },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Facture ${invoice.number}`}
        description={
          <>
            <Link href={`/fournisseurs/${invoice.supplier_id}`} className="hover:underline">
              {invoice.suppliers?.name}
            </Link>{" "}
            · du {formatDate(invoice.issue_date)}
            {invoice.legal_due_date && ` · date limite légale : ${formatDate(invoice.legal_due_date)}`}
          </>
        }
        actions={
          <InvoiceActions
            invoiceId={invoice.id}
            disputed={invoice.status === "disputed"}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        }
      />

      <div className="flex items-center gap-2">
        <InvoiceStatusBadge status={invoice.status} legalDueDate={invoice.legal_due_date} today={today} />
        {open && daysLeft !== null && daysLeft >= 0 && (
          <span className="text-sm text-muted-foreground">
            {daysLeft === 0 ? "Échéance légale aujourd'hui" : `${daysLeft} jour(s) avant l'échéance légale`}
          </span>
        )}
      </div>

      {remaining < 0 && (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            Les paiements émis dépassent le montant de la facture de {formatMAD(-remaining)}.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {amounts.map((item) => (
          <Card key={item.label} size="sm">
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">{formatMAD(item.value)}</CardTitle>
              {item.hint && <CardDescription className="text-xs">{item.hint}</CardDescription>}
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pièce jointe</CardTitle>
          <CardDescription>Scan ou photo de la facture, conservé de façon sécurisée.</CardDescription>
        </CardHeader>
        <CardContent>
          <AttachmentUpload
            organizationId={organization.organizationId}
            invoiceId={invoice.id}
            attachmentUrl={invoice.attachmentUrl}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paiements rattachés</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.allocations.length === 0 ? (
            <EmptyState
              icon={BanknoteIcon}
              title="Aucun paiement"
              description="Les chèques et LCN émis pour cette facture depuis l'assistant de paiement apparaîtront ici."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Émis le</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Débité le</TableHead>
                    <TableHead className="text-end">Montant affecté</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.allocations.map((allocation) => {
                    const payment = allocation.payments;
                    if (!payment) {
                      return null;
                    }
                    return (
                      <TableRow key={allocation.id}>
                        <TableCell>{PAYMENT_TYPE_LABELS[payment.type]}</TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {payment.number != null
                            ? formatInstrumentNumber(payment.number, payment.checkbooks?.number_width ?? 7)
                            : "—"}
                        </TableCell>
                        <TableCell>{formatDate(payment.issue_date)}</TableCell>
                        <TableCell>{payment.due_date ? formatDate(payment.due_date) : "—"}</TableCell>
                        <TableCell>{payment.debited_at ? formatDate(payment.debited_at) : "—"}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatMAD(allocation.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={paymentStatusVariant(payment.status)}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations de la facture</CardTitle>
          {!canEdit && <CardDescription>Votre rôle permet uniquement la consultation.</CardDescription>}
        </CardHeader>
        <CardContent>
          <InvoiceForm
            action={updateInvoice.bind(null, invoice.id)}
            suppliers={supplierOptions}
            invoice={invoice}
            submitLabel="Enregistrer"
            readOnly={!canEdit}
            supplierLocked={invoice.allocations.length > 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
