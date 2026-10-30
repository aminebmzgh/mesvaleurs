import { ArrowLeftIcon, BanknoteIcon, FileTextIcon, ScaleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES, WRITER_ROLES } from "@/lib/auth/roles";
import { CeilingDialog } from "@/components/ceiling-dialog";
import { todayIso } from "@/lib/dates";
import { formatDate, formatMAD } from "@/lib/format";
import {
  INVOICE_STATUS_LABELS,
  invoiceStatusVariant,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  paymentStatusVariant,
} from "@/lib/labels";
import { templateOptions } from "@/lib/letters/queries";
import { paymentNumber } from "@/lib/payments/label";
import { getSupplier } from "@/lib/suppliers/queries";
import { EnvelopeButton } from "@/components/envelope-button";
import { LetterDialog } from "../../courriers/letter-dialog";
import { setSupplierCeiling, updateSupplier } from "../actions";
import { SupplierForm } from "../supplier-form";
import { SupplierActiveToggle } from "./supplier-actions";

export const metadata: Metadata = { title: "Fournisseur" };

export default function SupplierPage({ params }: PageProps<"/fournisseurs/[id]">) {
  return (
    <>
      <Link href="/fournisseurs" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Fournisseurs
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <SupplierDetail params={params} />
      </Suspense>
    </>
  );
}

async function SupplierDetail({ params }: Pick<PageProps<"/fournisseurs/[id]">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }
  const [organization, supplier, statementTemplates] = await Promise.all([
    requireActiveOrganization(),
    getSupplier(id),
    templateOptions("statement_request"),
  ]);
  if (!supplier) {
    notFound();
  }
  const canEdit = WRITER_ROLES.includes(organization.role);
  const summary = supplier.summary;

  const totals = [
    { label: "Reste à payer", value: summary?.amount_due ?? 0, hint: `${summary?.open_invoice_count ?? 0} facture(s) ouverte(s)` },
    { label: "En circulation", value: summary?.amount_in_circulation ?? 0, hint: "Émis ou remis, pas encore débités" },
    { label: "Encaissé", value: summary?.amount_cashed ?? 0, hint: "Chèques et LCN débités" },
    { label: "Contesté", value: summary?.amount_disputed ?? 0, hint: "Exclu des montants à payer" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={supplier.name}
        description={
          <>
            {supplier.city ?? "Ville non renseignée"}
            {supplier.ice && ` · ICE ${supplier.ice}`}
            {supplier.payment_terms_days != null && ` · Délai convenu : ${supplier.payment_terms_days} jours`}
            {!supplier.is_active && " · Archivé"}
            {" · Plafond journalier : "}
            {ACCOUNT_MANAGER_ROLES.includes(organization.role) ? (
              <CeilingDialog
                id={supplier.id}
                name={supplier.name}
                ceiling={supplier.daily_ceiling}
                description="Au-delà de ce total de paiements datés du même jour pour ce fournisseur, les lots sont validés par une autre personne avant impression."
                action={setSupplierCeiling.bind(null, supplier.id)}
              />
            ) : supplier.daily_ceiling != null ? (
              formatMAD(supplier.daily_ceiling)
            ) : (
              "aucun"
            )}
          </>
        }
        actions={
          <>
            <LetterDialog
              trigger="Demande de relevé"
              title="Demande de relevé de compte"
              description="Lettre au fournisseur, avec les factures non soldées selon vos livres à la date d'arrêté."
              href={`/fournisseurs/${supplier.id}/releve`}
              templates={statementTemplates}
              date={{ param: "au", label: "Relevé arrêté au", defaultValue: todayIso(), max: todayIso() }}
            />
            <Link href={`/fournisseurs/${supplier.id}/rapprochement`} className={buttonVariants({ variant: "outline" })}>
              <ScaleIcon aria-hidden />
              Rapprocher son relevé
            </Link>
            <EnvelopeButton href={`/fournisseurs/${supplier.id}/enveloppe`} />
            {canEdit && <SupplierActiveToggle supplierId={supplier.id} isActive={supplier.is_active} />}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {totals.map((total) => (
          <Card key={total.label} size="sm">
            <CardHeader>
              <CardDescription>{total.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">{formatMAD(total.value)}</CardTitle>
              <CardDescription className="text-xs">{total.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Factures</CardTitle>
          <CardDescription>
            « Réglé » : couvert par des chèques ou LCN émis. « Encaissé » : effectivement débité en banque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {supplier.invoices.length === 0 ? (
            <EmptyState icon={FileTextIcon} title="Aucune facture" description="Les factures de ce fournisseur apparaîtront ici." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-end">Montant TTC</TableHead>
                    <TableHead className="text-end">Réglé</TableHead>
                    <TableHead className="text-end">Encaissé</TableHead>
                    <TableHead className="text-end">Reste dû</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.number}</TableCell>
                      <TableCell>{formatDate(invoice.issue_date)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(invoice.amount_incl_tax)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(invoice.amount_paid)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(invoice.amount_cashed)}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatMAD(invoice.amount_incl_tax - invoice.amount_paid)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={invoiceStatusVariant(invoice.status)}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paiements</CardTitle>
        </CardHeader>
        <CardContent>
          {supplier.payments.length === 0 ? (
            <EmptyState icon={BanknoteIcon} title="Aucun paiement" description="Les chèques et LCN émis pour ce fournisseur apparaîtront ici." />
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
                    <TableHead className="text-end">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{PAYMENT_TYPE_LABELS[payment.type]}</TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {paymentNumber(payment) || "—"}
                      </TableCell>
                      <TableCell>{formatDate(payment.issue_date)}</TableCell>
                      <TableCell>{payment.due_date ? formatDate(payment.due_date) : "—"}</TableCell>
                      <TableCell>{payment.debited_at ? formatDate(payment.debited_at) : "—"}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={paymentStatusVariant(payment.status)}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations du fournisseur</CardTitle>
          {!canEdit && <CardDescription>Votre rôle permet uniquement la consultation.</CardDescription>}
        </CardHeader>
        <CardContent>
          <SupplierForm
            action={updateSupplier.bind(null, supplier.id)}
            supplier={supplier}
            submitLabel="Enregistrer"
            readOnly={!canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
