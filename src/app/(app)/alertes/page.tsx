import { requireActiveOrganization } from "@/lib/auth/dal";
import { hasFeature } from "@/lib/billing/plans";
import { CircleCheckIcon, CircleXIcon, InfoIcon, MailIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AlertSeverity } from "@/lib/alerts/alerts";
import { getAlerts, getEmailAlertSettings } from "@/lib/alerts/queries";
import { formatDate } from "@/lib/format";
import { ALERT_DIGEST_STATUS_LABELS } from "@/lib/labels";
import { EmailAlertsForm } from "./email-alerts-form";

export const metadata: Metadata = { title: "Alertes" };

/** Éléments affichés par alerte (la suite est sur la page indiquée). */
const ITEM_LIMIT = 10;

const SEVERITY_ICONS: Record<AlertSeverity, typeof InfoIcon> = { critical: CircleXIcon, warning: TriangleAlertIcon, info: InfoIcon };

export default function AlertsPage() {
  return (
    <>
      <PageHeader
        title="Alertes"
        description="Échéances, rejets, provision et stock de formules à surveiller. Les délais d'alerte se règlent dans les paramètres de l'entreprise."
      />
      <div className="flex flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <AlertList />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-48 w-full max-w-3xl rounded-xl" />}>
          <EmailDigest />
        </Suspense>
      </div>
    </>
  );
}

async function AlertList() {
  const alerts = await getAlerts();
  if (alerts.length === 0) {
    return <EmptyState icon={CircleCheckIcon} title="Aucune alerte" description="Rien à signaler pour le moment." />;
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="Alertes en cours">
      {alerts.map((alert, index) => {
        const Icon = SEVERITY_ICONS[alert.severity];
        return (
          <li key={`${alert.kind}-${index}`}>
            <Alert variant={alert.severity === "critical" ? "destructive" : "default"}>
              <Icon aria-hidden />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>
                {alert.detail && <p>{alert.detail}</p>}
                {alert.items.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {alert.items.slice(0, ITEM_LIMIT).map((item, itemIndex) => (
                      <li key={itemIndex} className="flex flex-wrap items-center gap-x-2">
                        <span className="font-medium">{item.label}</span>
                        <span>{item.detail}</span>
                        {item.badge && <Badge variant={item.overdue ? "destructive" : "secondary"}>{item.badge}</Badge>}
                      </li>
                    ))}
                    {alert.items.length > ITEM_LIMIT && <li>… et {alert.items.length - ITEM_LIMIT} autre(s)</li>}
                  </ul>
                )}
                <Link href={alert.href} className="mt-2 block font-medium underline">
                  {alert.action}
                </Link>
              </AlertDescription>
            </Alert>
          </li>
        );
      })}
    </ul>
  );
}

async function EmailDigest() {
  const [organization, settings] = await Promise.all([requireActiveOrganization(), getEmailAlertSettings()]);
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailIcon className="size-4" aria-hidden />
          Récapitulatif par e-mail
        </CardTitle>
        <CardDescription>Chaque matin vers 8 h, les alertes ci-dessus envoyées aux membres de l&apos;entreprise qui l&apos;ont choisi.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!settings.sendingConfigured && (
          <Alert>
            <InfoIcon aria-hidden />
            <AlertDescription>
              L&apos;envoi des e-mails n&apos;est pas encore activé sur cette installation (domaine d&apos;envoi à vérifier). Les alertes restent
              visibles ici et sur le tableau de bord.
            </AlertDescription>
          </Alert>
        )}
        {!hasFeature(organization.plan, "alert_emails") ? (
          <p className="text-sm text-muted-foreground">
            Récapitulatif des alertes et résumé mensuel par e-mail : offre Pro et supérieures.{" "}
            <Link href="/parametres/abonnement" className="underline">
              Voir les offres
            </Link>
          </p>
        ) : settings.eligible ? (
          <EmailAlertsForm enabled={settings.enabled} monthlySummary={settings.monthlySummary} />
        ) : (
          <p className="text-sm text-muted-foreground">Le récapitulatif n&apos;est pas envoyé aux experts-comptables externes.</p>
        )}
        {settings.digests.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Envoi</TableHead>
                <TableHead className="text-right">Alertes</TableHead>
                <TableHead className="text-right">Destinataires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.digests.map((digest) => (
                <TableRow key={digest.id}>
                  <TableCell>{formatDate(digest.digest_date)}</TableCell>
                  <TableCell>
                    <Badge variant={digest.status === "failed" ? "destructive" : digest.status === "sent" ? "default" : "secondary"}>
                      {ALERT_DIGEST_STATUS_LABELS[digest.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{digest.alert_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{digest.recipient_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
