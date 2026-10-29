import { BookOpenIcon, CalendarClockIcon, HourglassIcon, CircleAlertIcon, CircleXIcon, ShieldAlertIcon, ClockAlertIcon, LandmarkIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/dashboard/queries";
import { formatDate, formatMAD } from "@/lib/format";
import { LEGAL_DISCLAIMER, REJECTION_KIND_LABELS } from "@/lib/labels";
import { countdownLabel } from "@/lib/payments/rejections";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function DashboardPage({ searchParams }: PageProps<"/tableau-de-bord">) {
  return (
    <>
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de vos règlements fournisseurs et de votre trésorerie." />
      <Suspense>
        <AccessDeniedNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function AccessDeniedNotice({ searchParams }: Pick<PageProps<"/tableau-de-bord">, "searchParams">) {
  const { erreur } = await searchParams;
  if (erreur !== "acces-refuse") {
    return null;
  }
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertDescription>Votre rôle ne vous permet pas d&apos;accéder à cette page.</AlertDescription>
    </Alert>
  );
}

async function Dashboard() {
  const data = await getDashboard();
  const lcn7 = data.lcnDue.filter((p) => p.daysLeft <= 7);
  const overdueTotal = data.overdue.reduce((sum, invoice) => sum + invoice.remaining, 0);

  const cards = [
    { label: "Solde bancaire", value: data.balance, hint: "Selon les derniers relevés importés" },
    { label: "En circulation", value: data.inCirculation, hint: "Chèques et LCN émis non débités" },
    {
      label: "Solde prévisionnel",
      value: data.projected,
      hint: "Solde − paiements en circulation",
      danger: data.projected < 0,
    },
    { label: "Reste à payer", value: data.remaining, hint: `${data.openInvoiceCount} facture(s) non soldée(s)` },
    ...(data.guaranteeCount > 0
      ? [
          {
            label: "Risque d'encaissement",
            value: data.guaranteeRisk,
            hint: `${data.guaranteeCount} chèque(s) de garantie chez les fournisseurs, hors prévisions`,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {(data.pendingBatchCount > 0 ||
        data.rejected.length > 0 ||
        data.guaranteesToRecover.length > 0 ||
        data.uncashed.count > 0 ||
        data.insufficientAccounts.length > 0 ||
        data.lowStock.length > 0) && (
        <div className="flex flex-col gap-3">
          {data.pendingBatchCount > 0 && (
            <Alert>
              <HourglassIcon aria-hidden />
              <AlertTitle>
                {data.pendingBatchCount} lot{data.pendingBatchCount > 1 ? "s" : ""} à valider avant impression
              </AlertTitle>
              <AlertDescription>
                <Link href="/paiements/a-valider" className="underline">
                  Voir les lots à valider
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {data.rejected.length > 0 && (
            <Alert variant="destructive">
              <CircleXIcon aria-hidden />
              <AlertTitle>
                {data.rejected.length} paiement{data.rejected.length > 1 ? "s" : ""} rejeté{data.rejected.length > 1 ? "s" : ""} à régulariser
              </AlertTitle>
              <AlertDescription>
                <ul className="flex flex-col gap-1">
                  {data.rejected.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{payment.label}</span>
                      <span>
                        {payment.supplier} · {formatMAD(payment.amount)}
                        {payment.kind && ` · ${REJECTION_KIND_LABELS[payment.kind].toLowerCase()}`}
                      </span>
                      <Badge variant={payment.state.kind === "overdue" ? "destructive" : "secondary"}>
                        {countdownLabel(payment.state)}
                        {(payment.state.kind === "pending" || payment.state.kind === "overdue") && ` · ${formatDate(payment.state.dueDate)}`}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <span className="mt-2 block">
                  <Link href="/paiements?statut=rejected" className="font-medium underline">
                    Régulariser
                  </Link>{" "}
                  · {LEGAL_DISCLAIMER}
                </span>
              </AlertDescription>
            </Alert>
          )}
          {data.guaranteesToRecover.length > 0 && (
            <Alert>
              <ShieldAlertIcon aria-hidden />
              <AlertTitle>Chèques de garantie à récupérer</AlertTitle>
              <AlertDescription>
                <ul className="flex flex-col gap-1">
                  {data.guaranteesToRecover.map((guarantee) => (
                    <li key={guarantee.id} className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{guarantee.label}</span>
                      <span>
                        {guarantee.supplier} · {formatMAD(guarantee.amount)}
                        {guarantee.purpose && ` · ${guarantee.purpose}`}
                      </span>
                      <Badge variant={guarantee.daysLeft < 0 ? "destructive" : "secondary"}>
                        {guarantee.daysLeft < 0
                          ? `restitution dépassée de ${-guarantee.daysLeft} j`
                          : `restitution le ${formatDate(guarantee.returnDue)}`}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <Link href="/paiements?type=guarantee_check" className="mt-2 block font-medium underline">
                  Voir les chèques de garantie
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {data.uncashed.count > 0 && (
            <Alert>
              <ClockAlertIcon aria-hidden />
              <AlertTitle>
                {data.uncashed.count} chèque{data.uncashed.count > 1 ? "s" : ""} non encaissé{data.uncashed.count > 1 ? "s" : ""} depuis plus de{" "}
                {data.uncashed.days} jours
              </AlertTitle>
              <AlertDescription>
                {formatMAD(data.uncashed.total)} restent bloqués dans le solde prévisionnel.{" "}
                <Link href="/paiements/non-encaisses" className="font-medium underline">
                  Relancer les fournisseurs
                </Link>
              </AlertDescription>
            </Alert>
          )}
          {data.insufficientAccounts.map((account) => (
            <Alert key={account.id} variant="destructive">
              <TriangleAlertIcon aria-hidden />
              <AlertTitle>Provision insuffisante : {account.label}</AlertTitle>
              <AlertDescription>
                Les chèques et LCN en circulation ({formatMAD(account.circulation)}) dépassent le solde ({formatMAD(account.current_balance)}).
                Solde prévisionnel : {formatMAD(account.projected)}.
              </AlertDescription>
            </Alert>
          ))}
          {data.lowStock.map((book) => (
            <Alert key={book.id}>
              <BookOpenIcon aria-hidden />
              <AlertTitle>{book.type === "lcn" ? "Carnet de LCN" : "Chéquier"} presque épuisé</AlertTitle>
              <AlertDescription>
                {book.account} : {book.remaining} formule(s) restante(s). Commandez un nouveau carnet à votre banque, puis{" "}
                <Link href={`/comptes-bancaires/${book.bankAccountId}`} className="underline">
                  enregistrez-le
                </Link>
                .
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className={cn("grid gap-4 sm:grid-cols-2", cards.length > 4 ? "lg:grid-cols-3 2xl:grid-cols-5" : "xl:grid-cols-4")}>
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className={cn("text-2xl tabular-nums", card.danger && "text-destructive")}>{formatMAD(card.value)}</CardTitle>
              <CardDescription className="text-xs">{card.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClockIcon className="size-4" aria-hidden />
              LCN à échoir sous 30 jours
            </CardTitle>
            <CardDescription>
              {data.lcnDue.length} LCN · {formatMAD(data.lcnDue.reduce((s, p) => s + p.amount, 0))}
              {lcn7.length > 0 && ` · dont ${lcn7.length} sous 7 jours`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.lcnDue.length === 0 && <p className="text-sm text-muted-foreground">Aucune échéance dans les 30 prochains jours.</p>}
            {data.lcnDue.slice(0, 8).map((lcn) => (
              <div key={lcn.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{lcn.supplier}</span>
                  <span className="font-mono text-xs text-muted-foreground">LCN {lcn.number}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant={lcn.daysLeft < 0 ? "destructive" : lcn.daysLeft <= 7 ? "secondary" : "outline"}>
                    {lcn.daysLeft < 0 ? `échue depuis ${-lcn.daysLeft} j` : lcn.daysLeft === 0 ? "aujourd'hui" : `${formatDate(lcn.dueDate)} · J-${lcn.daysLeft}`}
                  </Badge>
                  <span className="tabular-nums">{formatMAD(lcn.amount)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockAlertIcon className="size-4" aria-hidden />
              Factures en retard
            </CardTitle>
            <CardDescription>
              Date limite légale dépassée (loi 69-21, calcul indicatif) · {data.overdue.length} facture(s) · {formatMAD(overdueTotal)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.overdue.length === 0 && <p className="text-sm text-muted-foreground">Aucune facture en retard.</p>}
            {data.overdue.slice(0, 8).map((invoice) => (
              <Link key={invoice.id} href={`/factures/${invoice.id}`} className="flex items-center justify-between gap-2 rounded-md text-sm hover:bg-muted/50">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{invoice.supplier}</span>
                  <span className="text-xs text-muted-foreground">{invoice.number}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant="destructive">{invoice.daysLate} j de retard</Badge>
                  <span className="tabular-nums">{formatMAD(invoice.remaining)}</span>
                </span>
              </Link>
            ))}
            {data.overdue.length > 8 && (
              <Link href="/factures" className={buttonVariants({ variant: "link", size: "sm", className: "w-fit" })}>
                Voir toutes les factures
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LandmarkIcon className="size-4" aria-hidden />
            Dernières opérations bancaires
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.operations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune opération : <Link href="/rapprochement/importer" className="underline">importez un relevé</Link>.
            </p>
          )}
          {data.operations.map((operation) => (
            <div key={operation.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{operation.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(operation.operation_date)} · {operation.bank_accounts?.label}
                </span>
              </span>
              <span className={cn("shrink-0 tabular-nums", operation.credit && "text-emerald-700 dark:text-emerald-400")}>
                {operation.debit ? `−${formatMAD(operation.debit)}` : `+${formatMAD(operation.credit ?? 0)}`}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
