import { ArrowLeftIcon, InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { getTemplate, sampleData } from "@/lib/printing/queries";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Modèle d'impression" };

export default function TemplatePage({ params }: PageProps<"/comptes-bancaires/modeles/[id]">) {
  return (
    <>
      <Link href="/comptes-bancaires/modeles" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Modèles d&apos;impression
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Editor params={params} />
      </Suspense>
    </>
  );
}

async function Editor({ params }: Pick<PageProps<"/comptes-bancaires/modeles/[id]">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const template = await getTemplate(id);
  if (!template) {
    notFound();
  }
  const supabase = await createClient();
  const [{ data: org }, background] = await Promise.all([
    supabase.from("organizations").select("name, city").eq("id", organization.organizationId).single(),
    template.backgroundPath
      ? supabase.storage.from("modeles-impression").createSignedUrl(template.backgroundPath, 60 * 60)
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={template.name} description={template.type === "check" ? "Modèle de chèque" : "Modèle de LCN"} />
      <Alert>
        <InfoIcon aria-hidden />
        <AlertDescription>
          Calibrage : imprimez l&apos;<strong>impression test</strong> sur papier blanc, posez une vraie formule dessus à
          contre-jour et corrigez les zones. Si tout est décalé du même écart, réglez plutôt le décalage imprimante.
        </AlertDescription>
      </Alert>
      <TemplateEditor
        templateId={template.id}
        organizationId={organization.organizationId}
        type={template.type}
        initial={{
          name: template.name,
          widthMm: template.widthMm,
          heightMm: template.heightMm,
          offsetXMm: template.offsetXMm,
          offsetYMm: template.offsetYMm,
          zones: template.zones,
          options: template.options,
        }}
        backgroundUrl={background.data?.signedUrl ?? null}
        sample={sampleData(template.type, organization.amountWordsRectified, { name: org?.name ?? "", city: org?.city ?? "" })}
      />
    </div>
  );
}
