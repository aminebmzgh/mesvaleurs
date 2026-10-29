import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { parseOrganizationSettings } from "@/lib/organizations/settings";
import { createClient } from "@/lib/supabase/server";
import { AccountingExportForm } from "./accounting-form";

export const metadata: Metadata = { title: "Comptabilité" };

export default function AccountingSettingsPage() {
  return (
    <>
      <PageHeader
        title="Comptabilité"
        description="Comptes et format de l'export comptable mensuel, à ajuster avec votre expert-comptable selon son logiciel."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl rounded-xl" />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("settings").eq("id", organization.organizationId).single();
  return <AccountingExportForm settings={parseOrganizationSettings(data?.settings).accounting_export} readOnly={organization.role !== "admin"} />;
}
