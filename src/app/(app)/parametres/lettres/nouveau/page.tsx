import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { LETTER_KINDS } from "@/lib/letters/schemas";
import { BUILTIN_TEMPLATES, findBuiltinTemplate, LETTER_KIND_LABELS, type LetterKind } from "@/lib/letters/templates";
import { createLetterTemplate } from "../actions";
import { LetterTemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Nouveau modèle de lettre" };

export default function NewLetterTemplatePage({ searchParams }: PageProps<"/parametres/lettres/nouveau">) {
  return (
    <>
      <PageHeader title="Nouveau modèle de lettre" description="Courrier type avec variables, remplacées à la génération du PDF." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/parametres/lettres/nouveau">, "searchParams">) {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const { depuis, type } = await searchParams;
  // Copie d'un modèle intégré (son type de courrier), ou premier modèle du type demandé
  const kind: LetterKind = (LETTER_KINDS as readonly string[]).includes(String(type)) ? (type as LetterKind) : "cover_letter";
  const copied = typeof depuis === "string" ? findBuiltinTemplate(depuis) : null;
  const source = copied ?? { ...BUILTIN_TEMPLATES[kind][0], kind };
  return (
    <LetterTemplateForm
      action={createLetterTemplate}
      kind={source.kind}
      template={{ ...source, name: `${source.name} (personnalisé)` }}
      submitLabel={`Créer le modèle — ${LETTER_KIND_LABELS[source.kind].toLowerCase()}`}
    />
  );
}
