import type { Metadata } from "next";
import Form from "next/form";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { todayIso } from "@/lib/dates";
import { formatMAD } from "@/lib/format";
import { getStatistics } from "@/lib/stats/queries";
import { type StatPaymentType, topSuppliers } from "@/lib/stats/stats";
import { MonthlyColumns, SupplierBars } from "./stats-charts";

export const metadata: Metadata = { title: "Statistiques" };

const TYPE_LABELS: Record<StatPaymentType, string> = { check: "Chèques", lcn: "LCN", transfer: "Virements" };
const SELECT_CLASS = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

export default function StatisticsPage({ searchParams }: PageProps<"/statistiques">) {
  return (
    <>
      <PageHeader
        title="Statistiques"
        description="Règlements émis (chèques, LCN, virements ; hors annulés, rejetés et chèques de garantie), par date d'émission."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <StatisticsView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Période : 12 derniers mois (par défaut) ou une année civile. */
function period(value: unknown, today: string): { key: string; from: string; to: string; label: string } {
  const current = today.slice(0, 7);
  if (typeof value === "string" && /^\d{4}$/.test(value)) {
    const to = value === today.slice(0, 4) ? current : `${value}-12`;
    return { key: value, from: `${value}-01`, to, label: `Année ${value}` };
  }
  const [year, month] = current.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 12, 1));
  return { key: "12m", from: start.toISOString().slice(0, 7), to: current, label: "12 derniers mois" };
}

async function StatisticsView({ searchParams }: Pick<PageProps<"/statistiques">, "searchParams">) {
  // Organisation (cookies) avant la date du jour : rendu à la requête
  const [params] = await Promise.all([searchParams, requireActiveOrganization()]);
  const today = todayIso();
  const range = period(params.periode, today);
  const stats = await getStatistics(range.from, range.to);
  const year = Number(today.slice(0, 4));

  return (
    <div className="flex flex-col gap-6">
      <Form action="/statistiques" className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Période
          <select name="periode" defaultValue={range.key} className={SELECT_CLASS}>
            <option value="12m">12 derniers mois</option>
            {[year, year - 1, year - 2].map((y) => (
              <option key={y} value={String(y)}>
                Année {y}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Appliquer
        </Button>
      </Form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card size="sm" className="xl:col-span-2">
          <CardHeader>
            <CardDescription>Total réglé · {range.label}</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">{formatMAD(stats.total)}</CardTitle>
            <CardDescription className="text-xs">
              {stats.count} paiement{stats.count > 1 ? "s" : ""} · délai moyen de paiement{" "}
              {stats.averageDelay !== null ? `${stats.averageDelay} jours` : "—"}
            </CardDescription>
          </CardHeader>
        </Card>
        {(Object.keys(TYPE_LABELS) as StatPaymentType[]).map((type) => (
          <Card key={type} size="sm">
            <CardHeader>
              <CardDescription>{TYPE_LABELS[type]}</CardDescription>
              <CardTitle className="text-xl tabular-nums">{formatMAD(stats.byType[type].total)}</CardTitle>
              <CardDescription className="text-xs">
                {stats.byType[type].share.toLocaleString("fr-FR")} % · {stats.byType[type].count} paiement{stats.byType[type].count > 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dépenses par mois</CardTitle>
          <CardDescription>Total des règlements émis chaque mois ; survolez une colonne pour le détail.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <MonthlyColumns months={stats.byMonth} />
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Voir les valeurs</summary>
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-end">Paiements</TableHead>
                  <TableHead className="text-end">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byMonth.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{m.month.split("-").reverse().join("/")}</TableCell>
                    <TableCell className="text-end tabular-nums">{m.count}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMAD(m.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dépenses par fournisseur</CardTitle>
            <CardDescription>Les huit premiers fournisseurs, les autres regroupés.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.bySupplier.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun règlement sur la période.</p>
            ) : (
              <SupplierBars suppliers={topSuppliers(stats.bySupplier)} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Délai moyen de paiement par fournisseur</CardTitle>
            <CardDescription>
              Jours entre la date de la facture et la remise du paiement (à défaut son émission), pondérés par les montants réglés.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-end">Paiements</TableHead>
                  <TableHead className="text-end">Total réglé</TableHead>
                  <TableHead className="text-end">Délai moyen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.bySupplier.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-end tabular-nums">{s.count}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMAD(s.total)}</TableCell>
                    <TableCell className="text-end tabular-nums">{s.averageDelay !== null ? `${s.averageDelay} j` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
