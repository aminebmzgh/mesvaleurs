import { CircleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { formatMAD } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function DashboardPage({ searchParams }: PageProps<"/tableau-de-bord">) {
  return (
    <>
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de vos règlements fournisseurs." />
      <Suspense>
        <AccessDeniedNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardSummary />
      </Suspense>
    </>
  );
}

async function AccessDeniedNotice({ searchParams }: Pick<PageProps<"/tableau-de-bord">, "searchParams">) {
  const { erreur } = await searchParams;
  if (erreur !== "acces-refuse") {
    return null;
  }
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertDescription>Votre rôle ne vous permet pas d&apos;accéder à cette page.</AlertDescription>
    </Alert>
  );
}

const IN_CIRCULATION = ["issued", "delivered"] as const;

async function DashboardSummary() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;

  // Indicateurs simples ; le tableau de bord complet arrive en Phase 1
  const [accounts, inCirculation, openInvoices, suppliers] = await Promise.all([
    supabase.from("bank_accounts").select("current_balance").eq("organization_id", orgId).eq("is_active", true),
    supabase.from("payments").select("amount").eq("organization_id", orgId).in("status", IN_CIRCULATION),
    supabase
      .from("invoices")
      .select("amount_incl_tax, amount_paid")
      .eq("organization_id", orgId)
      .in("status", ["unpaid", "partially_paid"]),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);

  const sum = (values: number[]) => values.reduce((total, value) => total + Number(value), 0);
  const balance = sum((accounts.data ?? []).map((a) => a.current_balance));
  const circulating = sum((inCirculation.data ?? []).map((p) => p.amount));
  const remaining = sum((openInvoices.data ?? []).map((i) => i.amount_incl_tax - i.amount_paid));

  const cards = [
    { label: "Solde bancaire", value: formatMAD(balance), hint: `${accounts.data?.length ?? 0} compte(s) actif(s)` },
    {
      label: "En circulation",
      value: formatMAD(circulating),
      hint: `${inCirculation.data?.length ?? 0} chèque(s) / LCN émis non débités`,
    },
    {
      label: "Reste à payer",
      value: formatMAD(remaining),
      hint: `${openInvoices.data?.length ?? 0} facture(s) non soldée(s)`,
    },
    { label: "Fournisseurs", value: String(suppliers.count ?? 0), hint: "enregistrés" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{card.value}</CardTitle>
            <CardDescription className="text-xs">{card.hint}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}
