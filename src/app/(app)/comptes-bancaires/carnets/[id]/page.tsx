import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCheckbookInventoryData } from "@/lib/bank-accounts/queries";
import {
  CHECKBOOK_STATUS_LABELS,
  checkbookInventory,
  FORM_STATUS_LABELS,
  type FormStatus,
  formatInstrumentNumber,
  INSTRUMENT_LABELS,
  type StoppedRange,
} from "@/lib/checkbooks";
import { formatDate, formatMAD } from "@/lib/format";
import { PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Inventaire du carnet" };

const STATUS_VARIANTS: Record<FormStatus, "default" | "secondary" | "outline" | "destructive"> = {
  used: "secondary",
  cancelled: "outline",
  stopped: "destructive",
  remaining: "default",
  skipped: "destructive",
};

const STATUS_TITLES: Record<FormStatus, string> = {
  used: "Utilisées",
  cancelled: "Annulées",
  stopped: "En opposition",
  remaining: "Restantes",
  skipped: "Non attribuées",
};

const STATUS_HINTS: Record<FormStatus, string> = {
  used: "Paiements émis, en circulation ou débités",
  cancelled: "Formules gâchées ou paiements annulés",
  stopped: "Paiements et formules vierges en opposition",
  remaining: "Formules vierges encore disponibles",
  skipped: "Avant le prochain numéro, sans paiement : à vérifier",
};

export default function CheckbookInventoryPage({ params }: PageProps<"/comptes-bancaires/carnets/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Inventory params={params} />
    </Suspense>
  );
}

async function Inventory({ params }: Pick<PageProps<"/comptes-bancaires/carnets/[id]">, "params">) {
  const { id } = await params;
  const data = /^[0-9a-f-]{36}$/i.test(id) ? await getCheckbookInventoryData(id) : null;
  if (!data) {
    notFound();
  }
  const { book, account, payments, stops } = data;
  const width = book.number_width ?? 7;
  const number = (n: number) => formatInstrumentNumber(n, width);
  const { rows, counts } = checkbookInventory(
    { firstNumber: book.first_number!, lastNumber: book.last_number!, nextNumber: book.next_number! },
    payments.map((p) => ({ ...p, number: p.number!, guaranteeClosed: p.guarantee_outcome !== null })),
    stops.map((s): StoppedRange => [s.first_number, s.last_number]),
  );

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/comptes-bancaires/${book.bank_account_id}`} className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        {account?.label ?? "Compte bancaire"}
      </Link>
      <PageHeader
        title={`Inventaire — ${INSTRUMENT_LABELS[book.type!]} ${number(book.first_number!)} → ${number(book.last_number!)}`}
        description={
          <>
            {account?.label}
            {account?.banks?.name && ` · ${account.banks.name}`} · {CHECKBOOK_STATUS_LABELS[book.status!]}
            {book.received_at && ` · reçu le ${formatDate(book.received_at)}`}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(FORM_STATUS_LABELS) as FormStatus[]).map((status) => (
          <Card key={status} size="sm">
            <CardHeader>
              <CardDescription>{STATUS_TITLES[status]}</CardDescription>
              <CardTitle className={status === "skipped" && counts.skipped > 0 ? "text-xl text-destructive tabular-nums" : "text-xl tabular-nums"}>
                {counts[status]}
              </CardTitle>
              <CardDescription className="text-xs">{STATUS_HINTS[status]}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formules</CardTitle>
          <CardDescription>
            {book.last_number! - book.first_number! + 1} formules ; les numéros consécutifs sans paiement sont regroupés.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Émis le</TableHead>
                <TableHead className="text-end">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.first}>
                  <TableCell className="font-mono tabular-nums">
                    {row.first === row.last ? number(row.first) : `${number(row.first)} → ${number(row.last)}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[row.status]}>
                      {FORM_STATUS_LABELS[row.status]}
                      {row.last > row.first && ` (${row.last - row.first + 1})`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.payment ? (
                      <Link href={`/paiements?numero=${row.payment.number}&statut=all`} className="hover:underline">
                        {PAYMENT_TYPE_LABELS[row.payment.type]} · {PAYMENT_STATUS_LABELS[row.payment.status]}
                      </Link>
                    ) : row.status === "stopped" ? (
                      "Formule(s) vierge(s)"
                    ) : (
                      "—"
                    )}
                    {row.payment?.status === "cancelled" && row.payment.cancellation_reason && (
                      <span className="block max-w-64 truncate text-xs text-muted-foreground" title={row.payment.cancellation_reason}>
                        {row.payment.cancellation_reason}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{row.payment?.suppliers?.name ?? ""}</TableCell>
                  <TableCell>{row.payment ? formatDate(row.payment.issue_date) : ""}</TableCell>
                  <TableCell className="text-end tabular-nums">{row.payment ? formatMAD(row.payment.amount) : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
