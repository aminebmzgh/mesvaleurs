import { ArrowLeftIcon, BookOpenIcon, FileTextIcon } from "lucide-react";
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
import { ACCOUNT_MANAGER_ROLES, WRITER_ROLES } from "@/lib/auth/roles";
import { getBankAccount, listBanks, listStopOrders } from "@/lib/bank-accounts/queries";
import { todayIso } from "@/lib/dates";
import { LEGAL_DISCLAIMER, STOP_ORDER_REASON_LABELS } from "@/lib/labels";
import { defaultTemplateFor } from "@/lib/printing/default-templates";
import { listTemplates } from "@/lib/printing/queries";
import {
  CHECKBOOK_STATUS_LABELS,
  formatInstrumentNumber,
  INSTRUMENT_LABELS,
  isLowStock,
} from "@/lib/checkbooks";
import { formatDate, formatMAD } from "@/lib/format";
import { StopBlankFormsDialog } from "../../paiements/opposition-dialogs";
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
  const [organization, account, banks, templates, stopOrders] = await Promise.all([
    requireActiveOrganization(),
    getBankAccount(id),
    listBanks(),
    listTemplates(),
    listStopOrders(id),
  ]);
  if (!account) {
    notFound();
  }
  const canManage = ACCOUNT_MANAGER_ROLES.includes(organization.role);
  const canWrite = WRITER_ROLES.includes(organization.role);
  const today = todayIso();
  // Carnets dont des formules vierges restent à utiliser (opposition possible)
  const blankCheckbooks = account.checkbooks
    .filter((book) => book.next_number! <= book.last_number!)
    .map((book) => ({
      id: book.id!,
      label: `${INSTRUMENT_LABELS[book.type!]} ${formatInstrumentNumber(book.first_number!, book.number_width ?? 7)} → ${formatInstrumentNumber(book.last_number!, book.number_width ?? 7)}`,
      nextNumber: book.next_number!,
      lastNumber: book.last_number!,
      numberWidth: book.number_width ?? 7,
    }));
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
                    // Stock du compte pour ce type de carnet (carnets en service)
                    const low =
                      book.status === "active" &&
                      isLowStock(
                        account.checkbooks.map((c) => ({ bankAccountId: account.id, type: c.type!, status: c.status!, remaining: c.remaining_count ?? 0 })),
                        organization.lowStockThreshold,
                        account.id,
                        book.type!,
                      );
                    return (
                      <TableRow key={book.id}>
                        <TableCell>{INSTRUMENT_LABELS[book.type!]}</TableCell>
                        <TableCell className="font-mono tabular-nums">
                          <Link href={`/comptes-bancaires/carnets/${book.id}`} className="hover:underline" title="Inventaire du carnet">
                            {formatInstrumentNumber(book.first_number!, width)} → {formatInstrumentNumber(book.last_number!, width)}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {book.status === "exhausted" ? "—" : formatInstrumentNumber(book.next_number!, width)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          <span className={low ? "font-medium text-destructive" : undefined}>
                            {book.remaining_count} / {book.total_count}
                          </span>
                          {(book.stopped_blank_count ?? 0) > 0 && (
                            <span className="block text-xs text-muted-foreground">{book.stopped_blank_count} en opposition</span>
                          )}
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
          {canManage && account.is_active && <CheckbookForm accountId={account.id} accountRib={account.rib} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Oppositions</CardTitle>
          <CardDescription>
            Perte ou vol d&apos;un chèque, d&apos;une LCN ou de formules vierges : la lettre confirme l&apos;opposition par écrit à la
            banque. {LEGAL_DISCLAIMER}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {stopOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune opposition. Pour un chèque ou une LCN déjà émis, utilisez l&apos;action « Opposition » de la liste des paiements.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valeurs</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Constaté le</TableHead>
                    <TableHead>Déclaré le</TableHead>
                    <TableHead className="text-end">Lettre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stopOrders.map((stop) => {
                    const width = stop.checkbooks?.number_width ?? 7;
                    const kind = stop.checkbooks?.type === "lcn" ? "LCN" : "Chèque";
                    const numbers =
                      stop.first_number === stop.last_number
                        ? `n° ${formatInstrumentNumber(stop.first_number, width)}`
                        : `n° ${formatInstrumentNumber(stop.first_number, width)} à ${formatInstrumentNumber(stop.last_number, width)}`;
                    return (
                      <TableRow key={stop.id}>
                        <TableCell>
                          {stop.payments ? `${kind} ${numbers}` : `Formules vierges ${numbers}`}
                          {stop.payments && (
                            <span className="block text-xs text-muted-foreground">
                              {stop.payments.payee_name} · {formatMAD(stop.payments.amount)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{STOP_ORDER_REASON_LABELS[stop.reason]}</TableCell>
                        <TableCell>{formatDate(stop.occurred_on)}</TableCell>
                        <TableCell>{formatDate(stop.declared_on)}</TableCell>
                        <TableCell className="text-end">
                          <a
                            href={`/paiements/oppositions/${stop.id}/lettre`}
                            target="_blank"
                            rel="noopener"
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            <FileTextIcon aria-hidden />
                            PDF
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {canWrite && blankCheckbooks.length > 0 && (
            <div>
              <StopBlankFormsDialog checkbooks={blankCheckbooks} today={today} />
            </div>
          )}
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
