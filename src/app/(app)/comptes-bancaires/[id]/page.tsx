import { ArrowLeftIcon, BookOpenIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { getBankAccount, listBanks } from "@/lib/bank-accounts/queries";
import { defaultTemplateFor } from "@/lib/printing/default-templates";
import { listTemplates } from "@/lib/printing/queries";
import {
  CHECKBOOK_STATUS_LABELS,
  formatInstrumentNumber,
  INSTRUMENT_LABELS,
  LOW_STOCK_THRESHOLD,
} from "@/lib/checkbooks";
import { formatDate, formatMAD } from "@/lib/format";
import { updateBankAccount } from "../actions";
import { BankAccountForm } from "../bank-account-form";
import { AccountActiveToggle, CheckbookArchiveButton } from "./account-actions";
import { CheckbookForm } from "./checkbook-form";
import { CheckbookTemplateSelect } from "./checkbook-template-select";

export const metadata: Metadata = { title: "Compte bancaire" };

export default function BankAccountPage({ params }: PageProps<"/comptes-bancaires/[id]">) {
  return (
    <>
      <Link href="/comptes-bancaires" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Comptes et chéquiers
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <BankAccountDetail params={params} />
      </Suspense>
    </>
  );
}

async function BankAccountDetail({ params }: Pick<PageProps<"/comptes-bancaires/[id]">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }
  const [organization, account, banks, templates] = await Promise.all([
    requireActiveOrganization(),
    getBankAccount(id),
    listBanks(),
    listTemplates(),
  ]);
  if (!account) {
    notFound();
  }
  const canManage = ACCOUNT_MANAGER_ROLES.includes(organization.role);
  const bankShortName = banks.find((bank) => bank.id === account.bank_id)?.short_name ?? null;
  const update = updateBankAccount.bind(null, account.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={account.label}
        description={
          <>
            {account.banks?.name}
            {account.branch && ` · ${account.branch}`} · Solde : {" "}
            <span className="font-medium text-foreground tabular-nums">{formatMAD(account.current_balance)}</span>
          </>
        }
        actions={canManage && <AccountActiveToggle accountId={account.id} isActive={account.is_active} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Chéquiers et carnets de LCN</CardTitle>
          <CardDescription>
            La numérotation est séquentielle : un même numéro ne peut jamais être attribué deux fois.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {account.checkbooks.length === 0 ? (
            <EmptyState
              icon={BookOpenIcon}
              title="Aucun carnet"
              description="Enregistrez le chéquier ou le carnet de LCN fourni par la banque pour pouvoir émettre des paiements."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Numéros</TableHead>
                    <TableHead>Prochain</TableHead>
                    <TableHead className="text-end">Restantes</TableHead>
                    <TableHead className="text-end">Annulées</TableHead>
                    <TableHead>Reçu le</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Modèle d&apos;impression</TableHead>
                    {canManage && <TableHead className="text-end">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.checkbooks.map((book) => {
                    const width = book.number_width ?? 7;
                    const low = book.status === "active" && (book.remaining_count ?? 0) <= LOW_STOCK_THRESHOLD;
                    return (
                      <TableRow key={book.id}>
                        <TableCell>{INSTRUMENT_LABELS[book.type!]}</TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {formatInstrumentNumber(book.first_number!, width)} → {formatInstrumentNumber(book.last_number!, width)}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {book.status === "exhausted" ? "—" : formatInstrumentNumber(book.next_number!, width)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          <span className={low ? "font-medium text-destructive" : undefined}>
                            {book.remaining_count} / {book.total_count}
                          </span>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{book.cancelled_count}</TableCell>
                        <TableCell>{book.received_at ? formatDate(book.received_at) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={book.status === "active" ? (low ? "destructive" : "secondary") : "outline"}>
                            {low ? "Presque épuisé" : CHECKBOOK_STATUS_LABELS[book.status!]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const type = book.type ?? "check";
                            const defaultLabel = `Par défaut : ${defaultTemplateFor(type, bankShortName).name}`;
                            const options = templates
                              .filter((template) => template.type === type)
                              .map((template) => ({ value: template.id, label: template.name }));
                            if (!canManage) {
                              return (
                                <span className="text-xs text-muted-foreground">
                                  {options.find((o) => o.value === book.print_template_id)?.label ?? defaultLabel}
                                </span>
                              );
                            }
                            return (
                              <CheckbookTemplateSelect
                                checkbookId={book.id!}
                                value={book.print_template_id}
                                options={options}
                                defaultLabel={defaultLabel}
                              />
                            );
                          })()}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-end">
                            <CheckbookArchiveButton checkbookId={book.id!} archived={book.status === "archived"} />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {canManage && account.is_active && <CheckbookForm accountId={account.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations du compte</CardTitle>
          {!canManage && (
            <CardDescription>Seuls un administrateur ou un gestionnaire peuvent modifier ce compte.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <BankAccountForm
            action={update}
            banks={banks.map((bank) => ({ value: bank.id, label: bank.name }))}
            account={account}
            submitLabel="Enregistrer"
            readOnly={!canManage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
