import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAiStatus } from "@/lib/ai/usage";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { parseOrganizationSettings } from "@/lib/organizations/settings";
import { createClient } from "@/lib/supabase/server";
import { AiSettingsForm } from "./ai-settings-form";
import { LogoUpload } from "./logo-upload";
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
  const [{ data }, ai] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, ice, tax_id, trade_register, patente, cnss, address, city, phone, email, annual_revenue, settings, logo_path")
      .eq("id", organization.organizationId)
      .single(),
    getAiStatus(supabase, organization.organizationId),
  ]);

  if (!data) {
    return null;
  }

  const settings = parseOrganizationSettings(data.settings);
  const { logo_path: logoPath, ...fields } = data;
  // Aperçu du logo : lien signé de courte durée (bucket privé)
  const logoUrl = logoPath ? (await supabase.storage.from("logos").createSignedUrl(logoPath, 600)).data?.signedUrl ?? null : null;
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Imprimé en en-tête des lettres d&apos;accompagnement de règlement.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUpload organizationId={organization.organizationId} logoUrl={logoUrl} canEdit={organization.role === "admin"} />
        </CardContent>
      </Card>
      <OrganizationForm
        key={organization.organizationId}
        organization={{ ...fields, ...settings }}
        readOnly={organization.role !== "admin"}
      />
      {/* Sans clé du service d'IA sur le serveur, rien à régler */}
      {ai.configured && (
        <AiSettingsForm
          key={`ai-${organization.organizationId}`}
          enabled={settings.ai_enabled}
          consent={settings.ai_consent}
          quota={settings.ai_monthly_quota}
          used={ai.used}
          readOnly={organization.role !== "admin"}
        />
      )}
    </div>
  );
}
