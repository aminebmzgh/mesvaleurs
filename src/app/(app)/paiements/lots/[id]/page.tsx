import { ArrowLeftIcon, CircleCheckIcon, CircleXIcon, HourglassIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InstrumentPreview } from "@/components/instrument-preview";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization, requireUser } from "@/lib/auth/dal";
import { formatInstrumentNumber } from "@/lib/checkbooks";
import { formatDate, formatMAD } from "@/lib/format";
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS, paymentStatusVariant } from "@/lib/labels";
import { approvalReasonLabel, canDecideBatch, parseApprovalReasons } from "@/lib/payments/approvals";
import { getBatch } from "@/lib/payments/list";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { listCoverLetterTemplates } from "@/lib/letters/queries";
import { settlementReference } from "@/lib/letters/reference";
import { ApprovalActions } from "../../a-valider/approval-actions";
import { LetterActions } from "./letter-actions";
import { PrintButtons } from "./print-buttons";

export const metadata: Metadata = { title: "Lot de paiements" };

export default function BatchPage({ params, searchParams }: PageProps<"/paiements/lots/[id]">) {
  return (
    <>
      <Link href="/paiements" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Chèques et LCN
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <BatchDetail params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BatchDetail({ params, searchParams }: PageProps<"/paiements/lots/[id]">) {
  const [{ id }, { lettre }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }
  const [organization, user, batch, customTemplates] = await Promise.all([
    requireActiveOrganization(),
    requireUser(),
    getBatch(id),
    listCoverLetterTemplates(),
  ]);
  if (!batch || batch.payments.length === 0) {
    notFound();
  }
  const first = batch.payments[0];
  const total = batch.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const width = first.checkbooks?.number_width ?? 7;
  const typeLabel = PAYMENT_TYPE_LABELS[first.type];
  // Double signature : pas d'impression ni de lettre avant validation
  const awaiting = batch.approval_status === "pending";
  const refused = batch.approval_status === "refused";
  const reasons = parseApprovalReasons(batch.approval_reasons);
  const numbers = `${formatInstrumentNumber(first.number!, width)}${batch.payments.length > 1 ? ` à ${formatInstrumentNumber(batch.payments.at(-1)!.number!, width)}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${batch.payments.length} ${typeLabel.toLowerCase()}${batch.payments.length > 1 && first.type === "check" ? "s" : ""} pour ${first.suppliers?.name ?? ""}`}
        description={`Émis le ${formatDate(first.issue_date)} · total ${formatMAD(total)} · ${first.bank_accounts?.label ?? ""}`}
      />

      {awaiting && (
        <Alert>
          <HourglassIcon aria-hidden />
          <AlertTitle>En attente de validation</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Numéros réservés : {numbers}. Préparé par {batch.preparedByName ?? "—"} le {formatDate(batch.created_at)} ; à valider par un
              gestionnaire ou un administrateur avant impression.
            </span>
            <ul className="list-disc ps-5">
              {reasons.map((reason) => (
                <li key={reason.kind}>{approvalReasonLabel(reason)}</li>
              ))}
            </ul>
            {canDecideBatch(organization.role, user.id, batch.created_by) && (
              <ApprovalActions batchId={batch.id} label={`le lot ${numbers}`} />
            )}
          </AlertDescription>
        </Alert>
      )}
      {refused && (
        <Alert variant="destructive">
          <CircleXIcon aria-hidden />
          <AlertTitle>Lot refusé</AlertTitle>
          <AlertDescription>
            Refusé par {batch.decidedByName ?? "—"} le {batch.decided_at ? formatDate(batch.decided_at) : "—"} : {batch.refusal_reason}.
            Les formules réservées ({numbers}) sont à détruire ; leurs numéros restent dans l&apos;historique.
          </AlertDescription>
        </Alert>
      )}
      {!awaiting && !refused && (
        <Alert>
          <CircleCheckIcon aria-hidden />
          <AlertTitle>Numéros attribués</AlertTitle>
          <AlertDescription>
            {numbers}. Une formule gâchée s&apos;annule depuis la liste des chèques et LCN : son numéro reste dans l&apos;historique.
            {batch.approval_status === "approved" &&
              ` Validé par ${batch.decidedByName ?? "—"} le ${batch.decided_at ? formatDate(batch.decided_at) : "—"}.`}
          </AlertDescription>
        </Alert>
      )}

      {!awaiting && !refused && (
      <Card className={lettre === "1" ? "border-primary" : undefined}>
        <CardHeader>
          <CardTitle>Lettre d&apos;accompagnement et bordereau</CardTitle>
          <CardDescription>
            {lettre === "1"
              ? "À imprimer avec ce règlement, sur papier à en-tête (bac A4 séparé si besoin)."
              : "Lettre de règlement sur papier à en-tête et bordereau de remise signé par le fournisseur."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LetterActions
            batchId={batch.id}
            reference={settlementReference(first.issue_date, first.number)}
            customTemplates={customTemplates.map((t) => ({ key: t.key, name: t.name }))}
          />
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>Formules du lot</CardTitle>
          {WRITER_ROLES.includes(organization.role) && !awaiting && !refused && (
            <PrintButtons batchId={batch.id} printCount={batch.print_count} printedAt={batch.printed_at} />
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead className="text-end">Montant</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Factures réglées</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono tabular-nums">{formatInstrumentNumber(payment.number!, width)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMAD(payment.amount)}</TableCell>
                    <TableCell>{payment.due_date ? formatDate(payment.due_date) : "—"}</TableCell>
                    <TableCell>
                      {payment.payment_allocations.length === 0
                        ? "—"
                        : payment.payment_allocations.map((allocation) =>
                            allocation.invoices ? (
                              <Link key={allocation.invoices.id} href={`/factures/${allocation.invoices.id}`} className="me-2 hover:underline">
                                {allocation.invoices.number} ({formatMAD(allocation.amount)})
                              </Link>
                            ) : null,
                          )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={paymentStatusVariant(payment.status)}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {batch.payments.map((payment) => (
              <InstrumentPreview
                key={payment.id}
                type={payment.type === "lcn" ? "lcn" : "check"}
                bankName={payment.bank_accounts?.banks?.name ?? ""}
                number={payment.number}
                numberWidth={width}
                amount={payment.amount}
                payee={payment.payee_name}
                place={payment.issue_place ?? ""}
                issueDate={payment.issue_date}
                dueDate={payment.due_date}
                rectified={organization.amountWordsRectified}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
