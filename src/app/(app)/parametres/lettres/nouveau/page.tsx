import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { BUILTIN_LETTER_TEMPLATES } from "@/lib/letters/templates";
import { createLetterTemplate } from "../actions";
import { LetterTemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Nouveau modèle de lettre" };

export default function NewLetterTemplatePage({ searchParams }: PageProps<"/parametres/lettres/nouveau">) {
  return (
    <>
      <PageHeader title="Nouveau modèle de lettre" description="Lettre d'accompagnement de règlement, avec variables." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/parametres/lettres/nouveau">, "searchParams">) {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const { depuis } = await searchParams;
  // Copie d'un modèle intégré
  const source = BUILTIN_LETTER_TEMPLATES.find((t) => t.key === depuis) ?? BUILTIN_LETTER_TEMPLATES[0];
  return (
    <LetterTemplateForm
      action={createLetterTemplate}
      template={{ ...source, name: `${source.name} (personnalisé)` }}
      submitLabel="Créer le modèle"
    />
  );
}
