import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { formatDate, formatMAD } from "@/lib/format";
import { getImport } from "@/lib/statements/queries";
import { ReconciliationBoard } from "./reconciliation-board";

export const metadata: Metadata = { title: "Relevé" };

export default function ImportPage({ params }: PageProps<"/rapprochement/[id]">) {
  return (
    <>
      <Link href="/rapprochement" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Rapprochement
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ImportDetail params={params} />
      </Suspense>
    </>
  );
}

async function ImportDetail({ params }: Pick<PageProps<"/rapprochement/[id]">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }
  const [organization, detail] = await Promise.all([requireActiveOrganization(), getImport(id)]);
  if (!detail) {
    notFound();
  }
  const debit = detail.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const credit = detail.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
  const matched = detail.lines.filter((l) => l.status === "auto_matched" || l.status === "manually_matched");

  const cards = [
    { label: "Débits", value: formatMAD(debit) },
    { label: "Crédits", value: formatMAD(credit) },
    { label: "Chèques et LCN rapprochés", value: `${matched.length}`, hint: formatMAD(matched.reduce((s, l) => s + (l.debit ?? 0), 0)) },
    { label: "Paiements encore en circulation", value: `${detail.payments.length}`, hint: formatMAD(detail.payments.reduce((s, p) => s + p.amount, 0)) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Relevé ${detail.bank_accounts?.label ?? ""}`}
        description={`${detail.bank_accounts?.banks?.name ?? ""}${
          detail.period_start && detail.period_end ? ` · du ${formatDate(detail.period_start)} au ${formatDate(detail.period_end)}` : ""
        } · ${detail.lines.length} ligne(s)`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} size="sm">
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">{card.value}</CardTitle>
              {card.hint && <CardDescription className="text-xs">{card.hint}</CardDescription>}
            </CardHeader>
          </Card>
        ))}
      </div>
      <ReconciliationBoard detail={detail} canEdit={ACCOUNT_MANAGER_ROLES.includes(organization.role)} />
    </div>
  );
}
