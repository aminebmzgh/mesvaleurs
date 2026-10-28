import { CopyIcon, PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import { listCoverLetterTemplates } from "@/lib/letters/queries";
import { BUILTIN_LETTER_TEMPLATES } from "@/lib/letters/templates";
import { DeleteTemplateButton } from "./delete-template-button";

export const metadata: Metadata = { title: "Modèles de lettres" };

export default function LetterTemplatesPage() {
  return (
    <>
      <PageHeader
        title="Modèles de lettres"
        description="Lettres d'accompagnement de règlement : modèles intégrés, ou vos propres modèles avec variables."
        actions={
          <Link href="/parametres/lettres/nouveau" className={buttonVariants()}>
            <PlusIcon aria-hidden />
            Nouveau modèle
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Templates />
      </Suspense>
    </>
  );
}

async function Templates() {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const custom = await listCoverLetterTemplates();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Vos modèles</CardTitle>
          <CardDescription>Proposés sur la page de chaque lot, avec les modèles intégrés.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {custom.length === 0 && <p className="text-sm text-muted-foreground">Aucun modèle : copiez un modèle intégré pour l&apos;adapter.</p>}
          {custom.map((template) => (
            <div key={template.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{template.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {template.subject} · modifié le {formatDate(template.updatedAt)}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <Link href={`/parametres/lettres/${template.key}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <PencilIcon aria-hidden />
                  Modifier
                </Link>
                <DeleteTemplateButton id={template.key} name={template.name} />
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Modèles intégrés</CardTitle>
          <CardDescription>Toujours disponibles ; copiez-en un pour le personnaliser.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {BUILTIN_LETTER_TEMPLATES.map((template) => (
            <div key={template.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 font-medium">
                  {template.name} <Badge variant="outline">Intégré</Badge>
                </span>
                <span className="truncate text-xs text-muted-foreground">{template.subject}</span>
              </span>
              <Link href={`/parametres/lettres/nouveau?depuis=${template.key}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <CopyIcon aria-hidden />
                Copier
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
