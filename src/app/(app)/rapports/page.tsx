import { ChevronLeftIcon, ChevronRightIcon, FileSpreadsheetIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { FormSelect } from "@/components/form-select";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBankAccounts } from "@/lib/bank-accounts/queries";
import { todayIso } from "@/lib/dates";
import { formatDate, formatMAD } from "@/lib/format";
import { getMonthlyReport } from "@/lib/reports/monthly";
import { isMonth, monthLabel, shiftMonth } from "@/lib/reports/period";

export const metadata: Metadata = { title: "Rapport de fin de mois" };

type Params = Awaited<PageProps<"/rapports">["searchParams"]>;

export default function ReportsPage({ searchParams }: PageProps<"/rapports">) {
  return (
    <>
      <PageHeader
        title="Rapport de fin de mois"
        description="Chèques et LCN débités, paiements en circulation et anomalies de rapprochement."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function query(month: string, account: string | undefined, extra: Record<string, string> = {}) {
  return new URLSearchParams({ mois: month, ...(account ? { compte: account } : {}), ...extra }).toString();
}

async function Report({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const month = isMonth(params.mois) ? params.mois : todayIso().slice(0, 7);
  const account = typeof params.compte === "string" && /^[0-9a-f-]{36}$/i.test(params.compte) ? params.compte : undefined;
  const [report, accounts] = await Promise.all([getMonthlyReport(month, account), listBankAccounts()]);
  const anomalyCount =
    report.anomalies.amountMismatches.length +
    report.anomalies.unknownDebits.length +
    report.anomalies.missingNumbers.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/rapports?${query(shiftMonth(month, -1), account)}`} aria-label="Mois précédent" className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronLeftIcon aria-hidden />
          </Link>
          <h2 className="min-w-40 text-center text-lg font-semibold capitalize">{report.label}</h2>
          <Link href={`/rapports?${query(shiftMonth(month, 1), account)}`} aria-label="Mois suivant" className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronRightIcon aria-hidden />
          </Link>
        </div>
        <Form action="/rapports" className="flex flex-wrap items-center gap-2">
          <Input type="month" name="mois" defaultValue={month} aria-label="Mois" className="w-40" />
          <div className="w-56">
            <FormSelect
              name="compte"
              options={[{ value: "tous", label: "Tous les comptes" }, ...accounts.map((a) => ({ value: a.id, label: a.label }))]}
              defaultValue={account ?? "tous"}
            />
          </div>
          <Button type="submit" variant="outline">
            Afficher
          </Button>
        </Form>
        <div className="flex gap-2">
          <a href={`/rapports/export?${query(month, account, { format: "xlsx" })}`} className={buttonVariants({ variant: "outline" })}>
            <FileSpreadsheetIcon aria-hidden />
            Excel
          </a>
          <a href={`/rapports/export?${query(month, account, { format: "pdf" })}`} className={buttonVariants({ variant: "outline" })}>
            <FileTextIcon aria-hidden />
            PDF
          </a>
          <a
            href={`/rapports/export-comptable?mois=${month}`}
            className={buttonVariants({ variant: "outline" })}
            title="Journal des règlements fournisseurs du mois, au format réglé dans Paramètres › Comptabilité (tous les comptes)"
          >
            <FileSpreadsheetIcon aria-hidden />
            Export comptable (CSV)
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Débités en {monthLabel(month)}</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatMAD(report.paidTotal)}</CardTitle>
            <CardDescription className="text-xs">{report.paid.reduce((n, g) => n + g.payments.length, 0)} chèque(s) et LCN</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>En circulation</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatMAD(report.circulationTotal)}</CardTitle>
            <CardDescription className="text-xs">{report.circulation.length} émis non débités</CardDescription>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Anomalies</CardDescription>
            <CardTitle className="text-xl tabular-nums">{anomalyCount}</CardTitle>
            <CardDescription className="text-xs">écarts, débits inconnus, numéros manquants</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chèques et LCN débités</CardTitle>
          <CardDescription>Groupés par fournisseur, avec les factures qu&apos;ils règlent.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {report.paid.length === 0 && <p className="text-sm text-muted-foreground">Aucun débit rapproché ce mois-ci.</p>}
          {report.paid.map((group) => (
            <div key={group.supplier} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2 border-b pb-1">
                <h3 className="font-medium">{group.supplier}</h3>
                <span className="font-medium tabular-nums">{formatMAD(group.total)}</span>
              </div>
              <Table>
                <TableBody>
                  {group.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-xs">{payment.instrument}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        émis le {formatDate(payment.issueDate)} · débité le {formatDate(payment.debitedAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {payment.invoices.map((invoice) => `${invoice.number} (${formatMAD(invoice.amount)})`).join(", ") || "Sans facture"}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(payment.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>En circulation</CardTitle>
          <CardDescription>Émis ou remis, pas encore débités : les plus anciens d&apos;abord.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Formule</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Émis le</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Ancienneté</TableHead>
                <TableHead className="text-end">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.circulation.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Aucun paiement en circulation.
                  </TableCell>
                </TableRow>
              )}
              {report.circulation.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-xs">{payment.instrument}</TableCell>
                  <TableCell>{payment.supplier}</TableCell>
                  <TableCell>{formatDate(payment.issueDate)}</TableCell>
                  <TableCell>{payment.dueDate ? formatDate(payment.dueDate) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={payment.ageDays >= 60 ? "destructive" : payment.ageDays >= 30 ? "secondary" : "outline"}>
                      {payment.ageDays} j
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(payment.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {anomalyCount > 0 && <TriangleAlertIcon className="size-4 text-destructive" aria-hidden />}
            Anomalies
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <section aria-label="Écarts de montant">
            <h3 className="mb-1 font-medium">Montants différents ({report.anomalies.amountMismatches.length})</h3>
            {report.anomalies.amountMismatches.length === 0 ? (
              <p className="text-muted-foreground">Aucun écart.</p>
            ) : (
              <ul className="list-disc ps-5">
                {report.anomalies.amountMismatches.map((a, i) => (
                  <li key={i}>
                    {formatDate(a.date)} · {a.label} : débité {formatMAD(a.lineAmount)}, {a.instrument} émis {formatMAD(a.paymentAmount)}{" "}
                    {a.confirmed ? "(confirmé)" : "(à confirmer)"}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Débits inconnus">
            <h3 className="mb-1 font-medium">Chèques et LCN débités inconnus ({report.anomalies.unknownDebits.length})</h3>
            {report.anomalies.unknownDebits.length === 0 ? (
              <p className="text-muted-foreground">Aucun.</p>
            ) : (
              <ul className="list-disc ps-5">
                {report.anomalies.unknownDebits.map((u, i) => (
                  <li key={i}>
                    {formatDate(u.date)} · {u.label} (n° {u.number}) : {formatMAD(u.amount)}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Numéros manquants">
            <h3 className="mb-1 font-medium">Numéros manquants ({report.anomalies.missingNumbers.length})</h3>
            {report.anomalies.missingNumbers.length === 0 ? (
              <p className="text-muted-foreground">Aucun numéro sauté dans les carnets.</p>
            ) : (
              <ul className="list-disc ps-5">
                {report.anomalies.missingNumbers.map((m) => (
                  <li key={m.checkbook}>
                    {m.checkbook} : {m.numbers.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-label="Paiements annulés">
            <h3 className="mb-1 font-medium">Paiements annulés ce mois-ci ({report.anomalies.cancelled.length})</h3>
            {report.anomalies.cancelled.length === 0 ? (
              <p className="text-muted-foreground">Aucun.</p>
            ) : (
              <ul className="list-disc ps-5">
                {report.anomalies.cancelled.map((c, i) => (
                  <li key={i}>
                    {c.instrument} · {c.supplier} · {formatMAD(c.amount)} — {c.reason}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
