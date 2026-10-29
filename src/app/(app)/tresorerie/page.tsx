import { TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FORECAST_HORIZON_DAYS, type MovementKind } from "@/lib/forecast/forecast";
import { getForecast } from "@/lib/forecast/queries";
import { formatDate, formatMAD } from "@/lib/format";
import { ForecastChart } from "./forecast-chart";

export const metadata: Metadata = { title: "Prévision de trésorerie" };

const KIND_LABELS: Record<MovementKind, string> = {
  check: "Chèque en circulation",
  lcn: "LCN à échoir",
  transfer: "Virement en attente",
  invoice: "Facture à payer",
};

const SELECT_CLASS = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

export default function ForecastPage({ searchParams }: PageProps<"/tresorerie">) {
  return (
    <>
      <PageHeader
        title="Prévision de trésorerie"
        description={`Solde actuel − chèques en circulation (débitables à tout moment) − LCN et virements à leur date, sur ${FORECAST_HORIZON_DAYS} jours. Chèques de garantie exclus.`}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ForecastView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ForecastView({ searchParams }: Pick<PageProps<"/tresorerie">, "searchParams">) {
  const params = await searchParams;
  const requested = typeof params.compte === "string" && /^[0-9a-f-]{36}$/i.test(params.compte) ? params.compte : undefined;
  const { accounts, forecast, withInvoices } = await getForecast({
    accountId: requested,
    includeInvoices: params.factures === "1",
  });
  const accountId = accounts.some((a) => a.id === requested) ? requested : undefined;
  const movementDays = forecast.days.filter((day) => day.movements.length > 0);

  const figures = [
    { label: "Solde actuel", value: forecast.openingBalance, hint: "Selon les relevés importés" },
    { label: `Solde à ${FORECAST_HORIZON_DAYS} jours`, value: forecast.endBalance, hint: `Au ${formatDate(forecast.days.at(-1)!.date)}` },
    { label: "Point bas", value: forecast.low.balance, hint: `Le ${formatDate(forecast.low.date)}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Form action="/tresorerie" className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Compte
          <select name="compte" defaultValue={accountId ?? ""} className={SELECT_CLASS}>
            <option value="">Tous les comptes</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="factures" value="1" defaultChecked={params.factures === "1"} className="size-4 accent-primary" />
          Inclure les factures à payer (à leur échéance légale)
        </label>
        <Button type="submit" variant="outline">
          Appliquer
        </Button>
      </Form>
      {params.factures === "1" && !withInvoices && (
        <p className="text-sm text-muted-foreground">Les factures ne sont rattachées à aucun compte : elles s&apos;ajoutent seulement à la prévision de tous les comptes.</p>
      )}

      {forecast.firstNegative && (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>Solde prévisionnel négatif le {formatDate(forecast.firstNegative.date)}</AlertTitle>
          <AlertDescription>
            {formatMAD(forecast.firstNegative.balance)} ce jour-là ; point bas de {formatMAD(forecast.low.balance)} le {formatDate(forecast.low.date)}.
            Approvisionnez le compte ou reportez des échéances.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {figures.map((figure) => (
          <Card key={figure.label} size="sm">
            <CardHeader>
              <CardDescription>{figure.label}</CardDescription>
              <CardTitle className={figure.value < 0 ? "text-2xl text-destructive tabular-nums" : "text-2xl tabular-nums"}>{formatMAD(figure.value)}</CardTitle>
              <CardDescription className="text-xs">{figure.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solde prévisionnel</CardTitle>
          <CardDescription>
            {withInvoices ? "Paiements émis et factures à payer" : "Paiements émis"} · survolez la courbe (ou utilisez les flèches) pour le détail d&apos;un jour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForecastChart
            days={forecast.days.map((day) => ({ date: day.date, balance: day.balance, outflow: day.outflow, count: day.movements.length }))}
            firstNegative={forecast.firstNegative?.date ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Débits prévus</CardTitle>
          <CardDescription>Jour par jour, avec le solde après les débits du jour.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {movementDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun débit prévu sur la période.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-end">Montant</TableHead>
                  <TableHead className="text-end">Solde après</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementDays.flatMap((day) =>
                  day.movements.map((movement, i) => (
                    <TableRow key={`${day.date}-${i}`}>
                      <TableCell>{i === 0 ? formatDate(day.date) : ""}</TableCell>
                      <TableCell>
                        <Link href={movement.href} className="hover:underline">
                          {movement.label}
                        </Link>
                        <Badge variant="outline" className="ms-2">
                          {KIND_LABELS[movement.kind]}
                        </Badge>
                      </TableCell>
                      <TableCell>{movement.supplier}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(-movement.amount)}</TableCell>
                      <TableCell className={day.balance < 0 ? "text-end font-medium text-destructive tabular-nums" : "text-end tabular-nums"}>
                        {i === day.movements.length - 1 ? formatMAD(day.balance) : ""}
                      </TableCell>
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
