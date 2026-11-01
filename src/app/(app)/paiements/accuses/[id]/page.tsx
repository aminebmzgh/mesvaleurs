import { ArrowLeftIcon, CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { formatDate, formatDateTime, formatMAD } from "@/lib/format";
import { getReceipt } from "@/lib/receipts/queries";
import { ReceiptActions } from "./receipt-actions";

export const metadata: Metadata = { title: "Accusé de réception" };

export default function ReceiptDetailPage({ params, searchParams }: PageProps<"/paiements/accuses/[id]">) {
  return (
    <>
      <Link href="/paiements/accuses" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Accusés de réception
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl rounded-xl" />}>
        <ReceiptDetail params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ReceiptDetail({ params, searchParams }: PageProps<"/paiements/accuses/[id]">) {
  const [{ id }, { nouveau }, organization] = await Promise.all([params, searchParams, requireActiveOrganization()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }
  const data = await getReceipt(id);
  if (!data) {
    notFound();
  }
  const { receipt, supplier, payments, total } = data;
  const shareText = `Accusé de réception ${receipt.reference} : ${payments.length} valeur(s), ${formatMAD(total)}, remises à ${supplier.name} le ${formatDate(receipt.delivered_on)} et reçues par ${receipt.signer_name}.`;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={`Accusé de réception ${receipt.reference}`}
        description={`${supplier.name} · remis le ${formatDate(receipt.delivered_on)} · ${payments.length} valeur(s), ${formatMAD(total)}`}
      />
      {nouveau === "1" && (
        <Alert>
          <CircleCheckIcon aria-hidden />
          <AlertDescription>Remise signée enregistrée : les valeurs sont marquées remises à cette date.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reçu</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ReceiptActions
            receiptId={receipt.id}
            reference={receipt.reference}
            supplierEmail={receipt.emailed_to ?? supplier.email}
            shareText={shareText}
            canSend={WRITER_ROLES.includes(organization.role)}
          />
          {receipt.emailed_at && (
            <p className="text-sm text-muted-foreground">
              Dernier envoi par e-mail le {formatDateTime(receipt.emailed_at)} à {receipt.emailed_to}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signature</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <dl className="flex flex-col gap-2">
            <div>
              <dt className="text-muted-foreground">Reçu par</dt>
              <dd className="font-medium">{receipt.signer_name}</dd>
            </div>
            {receipt.signer_id_number && (
              <div>
                <dt className="text-muted-foreground">CIN</dt>
                <dd>{receipt.signer_id_number}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Signé le</dt>
              <dd>{formatDateTime(receipt.signed_at)}</dd>
            </div>
            {data.createdByName && (
              <div>
                <dt className="text-muted-foreground">Remise enregistrée par</dt>
                <dd>{data.createdByName}</dd>
              </div>
            )}
          </dl>
          <div className="flex flex-col gap-3">
            {data.signatureUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- lien signé de courte durée vers le stockage privé
              <img src={data.signatureUrl} alt={`Signature de ${receipt.signer_name}`} className="max-h-40 w-full rounded-md border bg-white object-contain" />
            )}
            {data.photoUrl && (
              <a href={data.photoUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- lien signé de courte durée vers le stockage privé */}
                <img src={data.photoUrl} alt="Photo des valeurs remises" className="max-h-48 rounded-md border object-contain" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valeurs remises</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valeur</TableHead>
                <TableHead>Banque</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead className="text-end">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {payment.number != null ? (
                      <Link href={`/paiements?numero=${payment.number}&statut=all`} className="font-medium hover:underline">
                        {payment.label}
                      </Link>
                    ) : (
                      payment.label
                    )}
                  </TableCell>
                  <TableCell>{payment.bank}</TableCell>
                  <TableCell>{payment.dueDate ? formatDate(payment.dueDate) : "—"}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(payment.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-end tabular-nums">{formatMAD(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
