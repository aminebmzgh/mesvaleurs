import { BanknoteIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FormSelect } from "@/components/form-select";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { daysBetween, todayIso } from "@/lib/dates";
import { formatDate, formatMAD } from "@/lib/format";
import {
  LEGAL_DISCLAIMER,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  REJECTION_KIND_LABELS,
  type RejectionKind,
  type PaymentStatus,
  type PaymentType,
  paymentStatusVariant,
} from "@/lib/labels";
import { paymentNumber } from "@/lib/payments/label";
import { listPayments, type PaymentFilter } from "@/lib/payments/list";
import { countdownLabel, type RegularizationState, regularizationState } from "@/lib/payments/rejections";
import { PaymentRowActions } from "./payment-row-actions";

export const metadata: Metadata = { title: "Chèques et LCN" };

const STATUS_FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: "circulation", label: "En circulation" },
  { value: "all", label: "Tous" },
  ...(Object.entries(PAYMENT_STATUS_LABELS) as [PaymentStatus, string][])
    .filter(([value]) => value !== "draft")
    .map(([value, label]) => ({ value, label })),
];

const TYPE_FILTERS = [
  { value: "tous", label: "Chèques et LCN" },
  ...(Object.entries(PAYMENT_TYPE_LABELS) as [PaymentType, string][]).map(([value, label]) => ({ value, label })),
];

export default function PaymentsPage({ searchParams }: PageProps<"/paiements">) {
  return (
    <>
      <PageHeader
        title="Chèques et LCN"
        description="Suivi des paiements émis, remis, débités, rejetés ou annulés."
        actions={
          <Suspense>
            <NewPaymentButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <PaymentList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewPaymentButton() {
  const organization = await requireActiveOrganization();
  if (!WRITER_ROLES.includes(organization.role)) {
    return null;
  }
  return (
    <>
      <Link href="/paiements/virement" className={buttonVariants({ variant: "outline" })}>
        <PlusIcon aria-hidden />
        Nouveau virement
      </Link>
      <Link href="/paiements/nouveau" className={buttonVariants()}>
        <PlusIcon aria-hidden />
        Nouveau paiement
      </Link>
    </>
  );
}

async function PaymentList({ searchParams }: Pick<PageProps<"/paiements">, "searchParams">) {
  const params = await searchParams;
  const status = STATUS_FILTERS.some((f) => f.value === params.statut) ? (params.statut as PaymentFilter) : "circulation";
  const type = TYPE_FILTERS.some((f) => f.value !== "tous" && f.value === params.type) ? (params.type as PaymentType) : undefined;
  const numberText = typeof params.numero === "string" ? params.numero.trim() : "";
  const number = /^\d{1,12}$/.test(numberText) ? Number(numberText) : undefined;

  const [organization, { payments, truncated }] = await Promise.all([
    requireActiveOrganization(),
    listPayments({ status, type, number }),
  ]);
  const canEdit = WRITER_ROLES.includes(organization.role);
  const today = todayIso();
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Form action="/paiements" className="grid gap-2 sm:grid-cols-[1fr_14rem_14rem_auto]" role="search">
          <Input type="search" name="numero" defaultValue={numberText} inputMode="numeric" placeholder="Numéro de chèque ou de LCN" aria-label="Rechercher par numéro" />
          <FormSelect name="type" options={TYPE_FILTERS} defaultValue={type ?? "tous"} />
          <FormSelect name="statut" options={STATUS_FILTERS} defaultValue={status} />
          <Button type="submit" variant="outline">
            <SearchIcon aria-hidden />
            Filtrer
          </Button>
        </Form>

        {payments.length === 0 ? (
          <EmptyState
            icon={BanknoteIcon}
            title="Aucun paiement"
            description={
              status === "circulation" && !type && number === undefined
                ? "Aucun chèque ni LCN en circulation."
                : "Aucun paiement ne correspond à ces critères."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead>Émis le</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead className="text-end">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  {canEdit && <TableHead className="text-end">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const formatted = paymentNumber(payment) || "—";
                  const age = daysBetween(payment.issue_date, today);
                  const inCirculation = payment.status === "issued" || payment.status === "delivered";
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{PAYMENT_TYPE_LABELS[payment.type]}</TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {payment.print_batch_id ? (
                          <Link href={`/paiements/lots/${payment.print_batch_id}`} className="hover:underline">
                            {formatted}
                          </Link>
                        ) : (
                          formatted
                        )}
                      </TableCell>
                      <TableCell>
                        {payment.suppliers && (
                          <Link href={`/fournisseurs/${payment.suppliers.id}`} className="hover:underline">
                            {payment.suppliers.name}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell>{payment.bank_accounts?.label}</TableCell>
                      <TableCell>
                        {formatDate(payment.issue_date)}
                        {inCirculation && age > 0 && <span className="block text-xs text-muted-foreground">il y a {age} j</span>}
                      </TableCell>
                      <TableCell>{payment.due_date ? formatDate(payment.due_date) : "—"}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(payment.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={paymentStatusVariant(payment.status)}>{PAYMENT_STATUS_LABELS[payment.status]}</Badge>
                        {payment.status === "cancelled" && payment.cancellation_reason && (
                          <span className="block max-w-48 truncate text-xs text-muted-foreground" title={payment.cancellation_reason}>
                            {payment.cancellation_reason}
                          </span>
                        )}
                        {payment.status === "rejected" && payment.rejection_kind && (
                          <RejectionInfo
                            kind={payment.rejection_kind}
                            rejectedAt={payment.rejected_at}
                            state={regularizationState(payment, today)}
                          />
                        )}
                        {payment.regularized_at && payment.regularization_method && payment.status !== "rejected" && (
                          <span className="block text-xs text-muted-foreground">
                            Rejet régularisé le {formatDate(payment.regularized_at)}
                          </span>
                        )}
                        {payment.status === "delivered" && payment.delivered_at && (
                          <span className="block text-xs text-muted-foreground">le {formatDate(payment.delivered_at)}</span>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <PaymentRowActions
                            paymentId={payment.id}
                            label={`${PAYMENT_TYPE_LABELS[payment.type].toLowerCase()} n° ${formatted}`}
                            type={payment.type}
                            status={payment.status}
                            regularized={payment.regularized_at !== null}
                            today={today}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6}>Total ({payments.length})</TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(total)}</TableCell>
                  <TableCell colSpan={canEdit ? 2 : 1} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
        {truncated && <p className="text-xs text-muted-foreground">Seuls les 300 paiements les plus récents sont affichés.</p>}
      </CardContent>
    </Card>
  );
}

/** Motif du rejet et compte à rebours de régularisation (loi 71-24). */
function RejectionInfo({ kind, rejectedAt, state }: { kind: RejectionKind; rejectedAt: string | null; state: RegularizationState }) {
  return (
    <span className="block text-xs text-muted-foreground" title={LEGAL_DISCLAIMER}>
      {REJECTION_KIND_LABELS[kind]}
      {rejectedAt && ` le ${formatDate(rejectedAt)}`}
      <span
        className={
          state.kind === "overdue" || (state.kind === "pending" && state.daysLeft <= 7)
            ? "block font-medium text-destructive"
            : "block font-medium text-foreground"
        }
      >
        {countdownLabel(state)}
        {(state.kind === "pending" || state.kind === "overdue") && ` · avant le ${formatDate(state.dueDate)}`}
      </span>
    </span>
  );
}
