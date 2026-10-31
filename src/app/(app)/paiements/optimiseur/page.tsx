import { StarIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseAmount } from "@/lib/amount";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { formatAmount, formatDate, formatMAD } from "@/lib/format";
import { type PlanAction, type PlanItem, PLAN_SETTINGS } from "@/lib/optimizer/plan";
import { getPaymentPlan } from "@/lib/optimizer/queries";

export const metadata: Metadata = { title: "Plan de paiement" };

const SECTIONS: { action: PlanAction; title: string; description: string; date: string }[] = [
  {
    action: "check_now",
    title: "Payer cette semaine",
    description: `Factures en retard ou dont la date limite tombe dans les ${PLAN_SETTINGS.weekDays} jours : chèque à émettre maintenant.`,
    date: "Émission",
  },
  {
    action: "check_later",
    title: "Chèques à programmer",
    description: `À émettre une semaine avant la date limite : la trésorerie prévisionnelle le permet.`,
    date: "À émettre le",
  },
  {
    action: "lcn",
    title: "LCN à programmer",
    description: "Trésorerie insuffisante pour un chèque : LCN à 30, 60 ou 90 jours, à la première échéance possible.",
    date: "Échéance",
  },
  {
    action: "defer",
    title: "À reporter",
    description: "Ni chèque ni LCN possibles dans les 90 jours sans passer sous la réserve : à négocier avec le fournisseur.",
    date: "Date limite",
  },
];

/** Paiement proposé : factures d'un même fournisseur, même moyen et même date. */
type Group = { key: string; action: PlanAction; supplierId: string; supplierName: string; strategic: boolean; date: string; items: PlanItem[] };

function groupItems(items: PlanItem[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const key = `${item.action}|${item.supplierId}|${item.date}`;
    const group = groups.get(key) ?? { key, action: item.action, supplierId: item.supplierId, supplierName: item.supplierName, strategic: item.strategic, date: item.date, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const sum = (items: PlanItem[], key: "remaining" | "fine") => items.reduce((total, item) => total + Math.round(item[key] * 100), 0) / 100;

export default function PaymentPlanPage({ searchParams }: PageProps<"/paiements/optimiseur">) {
  return (
    <>
      <PageHeader
        title="Plan de paiement"
        description="Proposition de règlement des factures en attente selon la trésorerie prévisionnelle, les dates limites légales, l'amende encourue et vos fournisseurs stratégiques."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Plan searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Plan({ searchParams }: Pick<PageProps<"/paiements/optimiseur">, "searchParams">) {
  const { reserve: reserveText } = await searchParams;
  const parsedReserve = typeof reserveText === "string" && reserveText.trim() !== "" ? parseAmount(reserveText) : null;
  const { organization, today, plan } = await getPaymentPlan(parsedReserve !== null && parsedReserve >= 0 ? parsedReserve : null);
  const canPay = WRITER_ROLES.includes(organization.role);
  const groups = groupItems(plan.items);

  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>Proposition indicative, à valider</AlertTitle>
        <AlertDescription>
          Calcul sur le solde de tous les comptes actifs, diminué des chèques en circulation, des LCN à échoir et des virements.
          Amendes calculées selon les paramètres de la loi 69-21. Chaque paiement est vérifié dans l&apos;assistant avant
          émission.
        </AlertDescription>
      </Alert>

      <Form action="/paiements/optimiseur" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Réserve de trésorerie à préserver (DH)
          <Input name="reserve" inputMode="decimal" defaultValue={formatAmount(plan.reserve)} className="w-48 tabular-nums" />
        </label>
        <Button type="submit" variant="outline">
          Recalculer
        </Button>
        <p className="text-xs text-muted-foreground">Valeur par défaut : Paramètres › Entreprise.</p>
      </Form>

      <section aria-label="Synthèse du plan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((section) => (
          <Card key={section.action} size="sm">
            <CardHeader>
              <CardDescription>{section.title}</CardDescription>
              <CardTitle className={`text-xl tabular-nums ${section.action === "defer" && plan.totals.defer > 0 ? "text-destructive" : ""}`}>
                {formatMAD(plan.totals[section.action])}
              </CardTitle>
              <CardDescription className="text-xs">
                {plan.items.filter((item) => item.action === section.action).length} facture(s)
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <p className="text-sm text-muted-foreground">
        Solde prévisionnel le plus bas : {formatMAD(plan.lowBefore.balance)} le {formatDate(plan.lowBefore.date)} sans le plan,{" "}
        {formatMAD(plan.lowAfter.balance)} le {formatDate(plan.lowAfter.date)} avec le plan
        {plan.fines > 0 && ` · amende indicative ${formatMAD(plan.fines)}`}
        {plan.notUrgent > 0 && ` · ${plan.notUrgent} facture(s) à échéance lointaine, hors plan`}.
      </p>

      {plan.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune facture à régler dans les {PLAN_SETTINGS.horizonDays} prochains jours.
        </p>
      )}

      {SECTIONS.map((section) => {
        const sectionGroups = groups.filter((group) => group.action === section.action);
        if (sectionGroups.length === 0) {
          return null;
        }
        return (
          <Card key={section.action}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table aria-label={section.title}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Factures</TableHead>
                    <TableHead>{section.date}</TableHead>
                    <TableHead className="text-end">Montant</TableHead>
                    <TableHead className="text-end">Amende</TableHead>
                    <TableHead>
                      <span className="sr-only">Action</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectionGroups.map((group) => {
                    const fine = sum(group.items, "fine");
                    return (
                      <TableRow key={group.key} aria-label={`${section.title} : ${group.supplierName}`}>
                        <TableCell>
                          <Link href={`/fournisseurs/${group.supplierId}`} className="font-medium hover:underline">
                            {group.supplierName}
                          </Link>
                          {group.strategic && (
                            <Badge variant="secondary" className="ms-2">
                              <StarIcon aria-hidden />
                              Stratégique
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {group.items.map((item) => (
                            <div key={item.id}>
                              <Link href={`/factures/${item.id}`} className="hover:underline">
                                {item.number}
                              </Link>{" "}
                              <span className={`text-xs ${item.legalDueDate < today ? "text-destructive" : "text-muted-foreground"}`}>
                                limite {formatDate(item.legalDueDate)}
                              </span>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          {formatDate(group.date)}
                          {group.items.some((item) => item.late) && section.action !== "defer" && (
                            <div className="text-xs text-destructive">après la date limite</div>
                          )}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{formatMAD(sum(group.items, "remaining"))}</TableCell>
                        <TableCell className={`text-end tabular-nums ${fine > 0 ? "text-destructive" : ""}`}>{fine > 0 ? formatMAD(fine) : "—"}</TableCell>
                        <TableCell>
                          {canPay && section.action !== "defer" && (
                            <Link
                              href={`/paiements/nouveau?${new URLSearchParams({
                                fournisseur: group.supplierId,
                                factures: group.items.map((item) => item.id).join(","),
                                mode: section.action === "lcn" ? "lcn" : "check",
                                ...(section.action === "lcn" && { echeance: group.date }),
                              })}`}
                              className={buttonVariants({ variant: section.action === "check_now" ? "default" : "outline", size: "sm" })}
                            >
                              Préparer {section.action === "lcn" ? "la LCN" : "le chèque"}
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

