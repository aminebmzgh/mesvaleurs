import { LandmarkIcon, PlusIcon, PrinterIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { listBankAccounts } from "@/lib/bank-accounts/queries";
import { INSTRUMENT_LABELS, stockByAccount } from "@/lib/checkbooks";
import { formatMAD } from "@/lib/format";
import { formatRib } from "@/lib/rib";

export const metadata: Metadata = { title: "Comptes et chéquiers" };

export default function BankAccountsPage() {
  return (
    <>
      <PageHeader
        title="Comptes et chéquiers"
        description="Comptes bancaires, chéquiers et carnets de LCN utilisés pour vos règlements."
        actions={
          <Suspense>
            <NewAccountButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <BankAccountList />
      </Suspense>
    </>
  );
}

async function NewAccountButton() {
  const organization = await requireActiveOrganization();
  if (!ACCOUNT_MANAGER_ROLES.includes(organization.role)) {
    return null;
  }
  return (
    <>
      <Link href="/comptes-bancaires/modeles" className={buttonVariants({ variant: "outline" })}>
        <PrinterIcon aria-hidden />
        Modèles d&apos;impression
      </Link>
      <Link href="/comptes-bancaires/nouveau" className={buttonVariants()}>
        <PlusIcon aria-hidden />
        Nouveau compte
      </Link>
    </>
  );
}

async function BankAccountList() {
  const [organization, accounts] = await Promise.all([requireActiveOrganization(), listBankAccounts()]);
  const canManage = ACCOUNT_MANAGER_ROLES.includes(organization.role);

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={LandmarkIcon}
        title="Aucun compte bancaire"
        description="Ajoutez le compte sur lequel vos chèques et LCN sont tirés, puis enregistrez ses chéquiers."
        action={
          canManage && (
            <Link href="/comptes-bancaires/nouveau" className={buttonVariants()}>
              Ajouter un compte
            </Link>
          )
        }
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {accounts.map((account) => {
        // Stock par type de carnet : somme des carnets en service
        const stock = stockByAccount(
          account.checkbooks.map((c) => ({ bankAccountId: account.id, type: c.type!, status: c.status!, remaining: c.remaining_count ?? 0 })),
          organization.lowStockThreshold,
        );
        return (
          <Link key={account.id} href={`/comptes-bancaires/${account.id}`} className="rounded-xl focus-visible:outline-2">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {account.label}
                  {!account.is_active && <Badge variant="outline">Archivé</Badge>}
                </CardTitle>
                <CardDescription>
                  {account.banks?.name}
                  {account.branch && ` · ${account.branch}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {account.rib && <p className="font-mono text-xs text-muted-foreground">{formatRib(account.rib)}</p>}
                <p className="text-2xl font-semibold tabular-nums">{formatMAD(account.current_balance)}</p>
                <div className="flex flex-wrap gap-2">
                  {stock.length === 0 ? (
                    <Badge variant="outline">Aucun carnet en service</Badge>
                  ) : (
                    stock.map((group) => (
                      <Badge key={group.type} variant={group.low ? "destructive" : "secondary"}>
                        {INSTRUMENT_LABELS[group.type]} : {group.remaining} restante(s)
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
