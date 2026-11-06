import { ClockAlertIcon, MailIcon, PhoneIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FormSelect } from "@/components/form-select";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { WRITER_ROLES } from "@/lib/auth/roles";
import { daysBetween, todayIso } from "@/lib/dates";
import { formatDate, formatMAD } from "@/lib/format";
import { PAYMENT_STATUS_LABELS } from "@/lib/labels";
import { UNCASHED_ALERT_CHOICES } from "@/lib/organizations/settings";
import { paymentLabel, paymentNumber } from "@/lib/payments/label";
import { listUncashedChecks } from "@/lib/payments/list";
import { reminderMailto } from "@/lib/payments/reminders";
import { PaymentRowActions } from "../payment-row-actions";

export const metadata: Metadata = { title: "Chèques non encaissés" };

export default function UncashedChecksPage({ searchParams }: PageProps<"/paiements/non-encaisses">) {
  return (
    <>
      <PageHeader
        title="Chèques non encaissés"
        description="Chèques émis depuis longtemps et pas encore débités : relancez le fournisseur, faites opposition ou réémettez. Ces montants restent bloqués dans le solde prévisionnel."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <UncashedList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function UncashedList({ searchParams }: Pick<PageProps<"/paiements/non-encaisses">, "searchParams">) {
  const params = await searchParams;
  const organization = await requireActiveOrganization();
  const requested = Number(params.jours);
  const days = (UNCASHED_ALERT_CHOICES as readonly number[]).includes(requested) ? requested : organization.uncashedAlertDays;
  const checks = await listUncashedChecks(days);
  const canEdit = WRITER_ROLES.includes(organization.role);
  const today = todayIso();
  const total = checks.reduce((sum, check) => sum + check.amount, 0);
  const choices = [...new Set([...UNCASHED_ALERT_CHOICES, organization.uncashedAlertDays])].sort((a, b) => a - b);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Form action="/paiements/non-encaisses" className="flex flex-wrap items-center gap-2" role="search">
          <span className="text-sm">Émis depuis plus de</span>
          <div className="w-36">
            <FormSelect name="jours" options={choices.map((value) => ({ value: String(value), label: `${value} jours` }))} defaultValue={String(days)} />
          </div>
          <Button type="submit" variant="outline">
            <SearchIcon aria-hidden />
            Afficher
          </Button>
        </Form>

        {checks.length === 0 ? (
          <EmptyState icon={ClockAlertIcon} title="Aucun chèque ancien" description={`Tous les chèques émis il y a plus de ${days} jours ont été encaissés.`} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chèque</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Émis le</TableHead>
                  <TableHead>Ancienneté</TableHead>
                  <TableHead className="text-end">Montant</TableHead>
                  {canEdit && <TableHead className="text-end">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks.map((check) => {
                  const supplier = check.suppliers;
                  const label = paymentLabel(check);
                  return (
                    <TableRow key={check.id} className="align-top">
                      <TableCell className="font-mono tabular-nums">
                        {paymentNumber(check)}
                        <span className="block font-sans text-xs text-muted-foreground">
                          {PAYMENT_STATUS_LABELS[check.status]}
                          {check.delivered_at && ` le ${formatDate(check.delivered_at)}`} · {check.bank_accounts?.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {supplier && (
                          <Link href={`/fournisseurs/${supplier.id}`} className="hover:underline">
                            {supplier.name}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {supplier?.contact_name && <span className="block">{supplier.contact_name}</span>}
                        {supplier?.phone && (
                          <a href={`tel:${supplier.phone.replace(/\s/g, "")}`} className="flex items-center gap-1 hover:underline">
                            <PhoneIcon className="size-3" aria-hidden />
                            {supplier.phone}
                          </a>
                        )}
                        {supplier?.email && (
                          <a
                            href={reminderMailto({
                              email: supplier.email,
                              contactName: supplier.contact_name,
                              label,
                              issueDate: check.issue_date,
                              amount: check.amount,
                              organizationName: organization.organizationName,
                            })}
                            className="flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <MailIcon className="size-3" aria-hidden />
                            Relancer par e-mail
                          </a>
                        )}
                        {!supplier?.phone && !supplier?.email && <span className="text-muted-foreground">Aucun contact</span>}
                      </TableCell>
                      <TableCell>{formatDate(check.issue_date)}</TableCell>
                      <TableCell>
                        <Badge variant={daysBetween(check.issue_date, today) >= days * 2 ? "destructive" : "secondary"}>
                          {daysBetween(check.issue_date, today)} j
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{formatMAD(check.amount)}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <PaymentRowActions
                            paymentId={check.id}
                            label={label.toLowerCase()}
                            type={check.type}
                            status={check.status}
                            issueDate={check.issue_date}
                            today={today}
                            plan={organization.plan}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Total bloqué ({checks.length})</TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(total)}</TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
