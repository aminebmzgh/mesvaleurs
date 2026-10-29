import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { findCustomTemplate } from "@/lib/letters/queries";
import { updateLetterTemplate } from "../actions";
import { LetterTemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Modèle de lettre" };

export default function LetterTemplatePage({ params }: PageProps<"/parametres/lettres/[id]">) {
  return (
    <>
      <PageHeader title="Modèle de lettre" description="Les lettres déjà générées ne changent pas : le modèle s'applique aux prochaines." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Form params={params} />
      </Suspense>
    </>
  );
}

async function Form({ params }: Pick<PageProps<"/parametres/lettres/[id]">, "params">) {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const { id } = await params;
  const template = await findCustomTemplate(id);
  if (!template) {
    notFound();
  }
  return <LetterTemplateForm action={updateLetterTemplate.bind(null, id)} kind={template.kind} template={template} submitLabel="Enregistrer" />;
}
