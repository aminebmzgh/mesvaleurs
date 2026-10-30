import { CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { ExportLinks } from "@/components/export-menu";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DECLARATION_ROLES } from "@/lib/auth/roles";
import { BASIS_LABELS, STATEMENT_KIND_LABELS } from "@/lib/compliance/export";
import { parseQuarterKey, previousQuarter, type Quarter, quarterKey, quarterLabel, quarterOf } from "@/lib/compliance/late-payments";
import { getCompliance } from "@/lib/compliance/queries";
import { daysBetween } from "@/lib/dates";
import { formatAmount, formatDate, formatMAD } from "@/lib/format";
import { PAYMENT_TYPE_LABELS } from "@/lib/labels";
import { DeclarationForm, UndoDeclarationButton } from "./declaration-form";

export const metadata: Metadata = { title: "Délais de paiement" };

const SELECT_CLASS = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

export default function CompliancePage({ searchParams }: PageProps<"/conformite">) {
  return (
    <>
      <PageHeader
        title="Délais de paiement"
        description="Loi 69-21 : factures dans les délais ou en retard, amende indicative, état trimestriel pour votre expert-comptable et suivi de la déclaration."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ComplianceView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Les 8 derniers trimestres, du plus récent au plus ancien (trimestre en cours compris). */
function recentQuarters(today: string): Quarter[] {
  const quarters = [quarterOf(today)];
  while (quarters.length < 8) {
    quarters.push(previousQuarter(quarters.at(-1)!));
  }
  return quarters;
}

async function ComplianceView({ searchParams }: Pick<PageProps<"/conformite">, "searchParams">) {
  const params = await searchParams;
  const requested = parseQuarterKey(typeof params.trimestre === "string" ? params.trimestre : null);
  const data = await getCompliance(requested);
  const { indicators, quarter, rows, totals, declaration, deadline, today } = data;
  const canDeclare = DECLARATION_ROLES.includes(data.organization.role);
  const daysLeft = daysBetween(today, deadline);
  const quarterEnded = data.range.end < today;

  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>Calculs indicatifs — à valider par votre expert-comptable</AlertTitle>
        <AlertDescription>
          Taux, délais et seuils proviennent des paramètres légaux de l&apos;application et peuvent évoluer. Date de paiement retenue :{" "}
          {BASIS_LABELS[data.basis]} (
          <Link href="/parametres/organisation" className="underline">
            modifiable
          </Link>
          ).
        </AlertDescription>
      </Alert>

      {data.annualRevenue === null ? (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertDescription>
            Renseignez le chiffre d&apos;affaires annuel dans{" "}
            <Link href="/parametres/organisation" className="underline">
              Paramètres › Entreprise
            </Link>{" "}
            : la déclaration trimestrielle concerne les entreprises dont le chiffre d&apos;affaires atteint{" "}
            {formatMAD(data.params.revenueThreshold)}.
          </AlertDescription>
        </Alert>
      ) : (
        !data.required && (
          <Alert>
            <InfoIcon aria-hidden />
            <AlertDescription>
              Chiffre d&apos;affaires inférieur à {formatMAD(data.params.revenueThreshold)} : l&apos;entreprise n&apos;est a priori pas tenue
              de déclarer ses délais de paiement. Aucun rappel n&apos;est envoyé.
            </AlertDescription>
          </Alert>
        )
      )}

      <section aria-label="Factures à payer" className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Dans les délais", value: indicators.onTime },
          { label: `Date limite sous ${data.organization.invoiceAlertDays} jours`, value: indicators.dueSoon },
          { label: "En retard", value: indicators.late, alert: indicators.late.count > 0 },
        ].map((card) => (
          <Card key={card.label} size="sm">
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className={`text-2xl tabular-nums ${card.alert ? "text-destructive" : ""}`}>{formatMAD(card.value.amount)}</CardTitle>
              <CardDescription className="text-xs">
                {card.value.count} facture{card.value.count > 1 ? "s" : ""} non soldée{card.value.count > 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Form action="/conformite" className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Trimestre
          <select name="trimestre" defaultValue={quarterKey(quarter)} className={SELECT_CLASS}>
            {recentQuarters(today).map((q) => (
              <option key={quarterKey(q)} value={quarterKey(q)}>
                {quarterLabel(q)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          Afficher
        </Button>
      </Form>

      <Card>
        <CardHeader>
          <CardTitle>Déclaration du {quarterLabel(quarter)}</CardTitle>
          <CardDescription>
            À déposer au plus tard le {formatDate(deadline)}
            {!declaration && quarterEnded && (daysLeft >= 0 ? ` (dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""})` : " : date limite dépassée")}
            {!quarterEnded && " · trimestre en cours"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {declaration ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">
                <CircleCheckIcon aria-hidden />
                Déclaré
              </Badge>
              <span>
                Déposée le {formatDate(declaration.declared_on)}
                {declaration.reference && ` · ${declaration.reference}`}
              </span>
              {canDeclare && <UndoDeclarationButton id={declaration.id} />}
            </div>
          ) : canDeclare && quarterEnded ? (
            <DeclarationForm quarter={quarter} today={today} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {quarterEnded ? "Non déclarée. La direction ou la comptabilité la marque comme déclarée une fois déposée." : "Le trimestre n'est pas terminé."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>État trimestriel · {quarterLabel(quarter)}</CardTitle>
          <CardDescription>
            Du {formatDate(data.range.start)} au {formatDate(data.range.end)} : factures payées hors délai pendant le trimestre, et restes
            impayés échus à sa fin. Amende : {formatAmount(data.params.firstMonthRate)} % le premier mois de retard,{" "}
            {formatAmount(data.params.additionalMonthRate)} % par mois supplémentaire (tout mois commencé compte).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              Payé hors délai {formatMAD(totals.latePaid)} · impayé échu {formatMAD(totals.unpaid)} ·{" "}
              <strong>amende indicative {formatMAD(totals.fines)}</strong>
            </span>
            <ExportLinks path="/conformite/export" params={{ trimestre: quarterKey(quarter) }} />
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune facture payée hors délai ni restée impayée au-delà de sa date limite.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label={`État des délais de paiement du ${quarterLabel(quarter)}`}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Date limite</TableHead>
                    <TableHead>Situation</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead className="text-end">Montant</TableHead>
                    <TableHead className="text-end">Retard</TableHead>
                    <TableHead className="text-end">Amende</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={`${row.invoiceId}-${index}`}>
                      <TableCell>
                        <Link href={`/factures/${row.invoiceId}`} className="font-medium hover:underline">
                          {row.invoiceNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">du {formatDate(row.invoiceDate)}</div>
                      </TableCell>
                      <TableCell>
                        {row.supplier}
                        {row.ice && <div className="font-mono text-xs text-muted-foreground">ICE {row.ice}</div>}
                      </TableCell>
                      <TableCell>{formatDate(row.legalDueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={row.kind === "unpaid" ? "destructive" : "secondary"}>{STATEMENT_KIND_LABELS[row.kind]}</Badge>
                      </TableCell>
                      <TableCell>
                        {row.paymentType ? (
                          <>
                            {PAYMENT_TYPE_LABELS[row.paymentType]} {row.paymentReference}
                            <div className="text-xs text-muted-foreground">le {formatDate(row.paidOn!)}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(row.amount)}</TableCell>
                      <TableCell className="text-end tabular-nums">{row.monthsLate} mois</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(row.fine)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={7}>Total de l&apos;amende indicative</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMAD(totals.fines)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
