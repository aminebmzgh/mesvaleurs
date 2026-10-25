import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = { title: "Entreprise" };

export default function OrganizationSettingsPage() {
  return (
    <>
      <PageHeader
        title="Entreprise"
        description="Informations imprimées sur les lettres d'accompagnement et utilisées pour la loi 69-21."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-3xl rounded-xl" />}>
        <OrganizationSettings />
      </Suspense>
    </>
  );
}

async function OrganizationSettings() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("name, ice, tax_id, trade_register, patente, cnss, address, city, phone, email, annual_revenue, settings")
    .eq("id", organization.organizationId)
    .single();

  if (!data) {
    return null;
  }

  const settings = (data.settings ?? {}) as { require_mfa?: boolean };
  return (
    <OrganizationForm
      key={organization.organizationId}
      organization={{ ...data, require_mfa: Boolean(settings.require_mfa) }}
      readOnly={organization.role !== "admin"}
    />
  );
}
