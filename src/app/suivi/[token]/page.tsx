import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, formatMAD } from "@/lib/format";
import { PORTAL_TYPE_LABELS, type PortalData, type PortalTone, portalStatus, portalTotals } from "@/lib/suppliers/portal";
import { getPortal } from "@/lib/suppliers/portal-queries";

// Lien secret : jamais référencé, jamais transmis aux sites suivants
export const metadata: Metadata = {
  title: "Suivi des règlements",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const TONE_VARIANT: Record<PortalTone, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  progress: "secondary",
  done: "default",
  problem: "destructive",
};

export default function SupplierPortalPage({ params }: PageProps<"/suivi/[token]">) {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          <Portal params={params} />
        </Suspense>
      </main>
      <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
        Suivi en lecture seule fourni par MesValeurs. Ce lien est personnel : ne le transmettez pas.
      </footer>
    </div>
  );
}

async function Portal({ params }: Pick<PageProps<"/suivi/[token]">, "params">) {
  const { token } = await params;
  const data = await getPortal(token);
  if (!data) {
    return <InactiveLink />;
  }
  return <PortalContent data={data} />;
}

function InactiveLink() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <LinkIcon className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Ce lien de suivi n&apos;est plus actif</h1>
      <p className="text-sm text-muted-foreground">
        Il a peut-être été remplacé par un nouveau lien. Demandez le lien à jour à l&apos;entreprise qui vous règle.
      </p>
    </div>
  );
}

function PortalContent({ data }: { data: PortalData }) {
  const totals = portalTotals(data);
  const contact = [data.organization.phone, data.organization.email].filter(Boolean).join(" · ");
  const cards = [
    { label: "À remettre", value: totals.pending, hint: "Prêts chez votre client" },
    { label: "Remis, à encaisser", value: totals.inProgress, hint: "En votre possession ou virement ordonné" },
    { label: "Encaissés", value: totals.done, hint: "Débités sur le compte de votre client" },
    { label: "Reste à régler", value: totals.outstanding, hint: `${data.openInvoices.length} facture(s) ouverte(s)` },
  ];

  return (
    <>
      <header className="flex flex-col gap-4">
        <BrandMark />
        <div>
          <p className="text-sm text-muted-foreground">Suivi des règlements de</p>
          <h1 className="text-2xl font-semibold">{data.organization.name}</h1>
          <p className="text-sm text-muted-foreground">
            à {data.supplier.name}
            {data.organization.city && ` · ${data.organization.city}`}
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} size="sm">
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">{formatMAD(card.value)}</CardTitle>
              <CardDescription className="text-xs">{card.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Règlements</CardTitle>
          <CardDescription>Chèques, LCN et virements émis à votre nom, du plus récent au plus ancien.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun règlement pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Règlement</TableHead>
                    <TableHead>Émis le</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Factures réglées</TableHead>
                    <TableHead className="text-end">Montant</TableHead>
                    <TableHead>Suivi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((payment) => {
                    const status = portalStatus(payment);
                    return (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="font-medium">
                            {PORTAL_TYPE_LABELS[payment.type]}
                            {payment.number != null && <span className="font-mono tabular-nums"> n° {payment.number}</span>}
                          </div>
                          {payment.bank && <div className="text-xs text-muted-foreground">{payment.bank}</div>}
                        </TableCell>
                        <TableCell>{formatDate(payment.issueDate)}</TableCell>
                        <TableCell>{payment.dueDate ? formatDate(payment.dueDate) : "—"}</TableCell>
                        <TableCell className="text-xs">
                          {payment.invoices.length === 0
                            ? "—"
                            : payment.invoices.map((invoice) => (
                                <div key={invoice.number}>
                                  {invoice.number} <span className="text-muted-foreground tabular-nums">({formatMAD(invoice.amount)})</span>
                                </div>
                              ))}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{formatMAD(payment.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={TONE_VARIANT[status.tone]}>{status.label}</Badge>
                          {status.date && <div className="mt-1 text-xs text-muted-foreground">le {formatDate(status.date)}</div>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Factures en attente de règlement</CardTitle>
          <CardDescription>Factures enregistrées par votre client et pas encore entièrement réglées.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.openInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Toutes vos factures enregistrées sont réglées.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-end">Montant TTC</TableHead>
                    <TableHead className="text-end">Déjà réglé</TableHead>
                    <TableHead className="text-end">Reste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.openInvoices.map((invoice) => (
                    <TableRow key={invoice.number}>
                      <TableCell className="font-medium">
                        {invoice.number}
                        {invoice.disputed && (
                          <Badge variant="outline" className="ms-2">
                            En cours d&apos;examen
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                      <TableCell>{invoice.dueDate ? formatDate(invoice.dueDate) : "—"}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(invoice.amountInclTax)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(invoice.amountPaid)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(invoice.amountInclTax - invoice.amountPaid)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Informations à jour au {formatDateTime(data.generatedAt)}, établies par {data.organization.name} à partir de sa comptabilité.
        {contact && ` Une question ? ${contact}.`}
      </p>
    </>
  );
}
