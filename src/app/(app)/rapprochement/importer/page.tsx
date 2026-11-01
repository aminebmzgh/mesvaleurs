import { ArrowLeftIcon, LandmarkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { listBankAccounts } from "@/lib/bank-accounts/queries";
import { getInboundForImport } from "@/lib/inbound/queries";
import { StatementImport } from "./statement-import";

export const metadata: Metadata = { title: "Importer un relevé" };

export default function ImportStatementPage({ searchParams }: PageProps<"/rapprochement/importer">) {
  return (
    <>
      <Link href="/rapprochement" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Rapprochement
      </Link>
      <PageHeader
        title="Importer un relevé"
        description="Les chèques et LCN débités sont rapprochés automatiquement ; le reste est proposé à confirmer."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Import searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Import({ searchParams }: Pick<PageProps<"/rapprochement/importer">, "searchParams">) {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const { boite } = await searchParams;
  const [accounts, inbound] = await Promise.all([
    listBankAccounts().then((list) => list.filter((account) => account.is_active)),
    // Relevé reçu par e-mail, chargé directement dans l'écran d'import
    typeof boite === "string" && /^[0-9a-f-]{36}$/i.test(boite) ? getInboundForImport(boite) : null,
  ]);
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={LandmarkIcon}
        title="Aucun compte bancaire"
        description="Ajoutez d'abord le compte bancaire dont vous importez le relevé."
        action={
          <Link href="/comptes-bancaires/nouveau" className={buttonVariants()}>
            Ajouter un compte
          </Link>
        }
      />
    );
  }
  return (
    <StatementImport
      organizationId={organization.organizationId}
      accounts={accounts.map((account) => ({ id: account.id, label: account.label, bankName: account.banks?.name ?? "" }))}
      inbound={inbound}
    />
  );
}
