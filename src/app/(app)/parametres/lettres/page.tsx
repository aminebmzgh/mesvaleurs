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
import { listLetterTemplates } from "@/lib/letters/queries";
import { BUILTIN_TEMPLATES, LETTER_KIND_DESCRIPTIONS, LETTER_KIND_LABELS, type LetterKind } from "@/lib/letters/templates";
import { DeleteTemplateButton } from "./delete-template-button";

export const metadata: Metadata = { title: "Modèles de lettres" };

export default function LetterTemplatesPage() {
  return (
    <>
      <PageHeader
        title="Modèles de lettres"
        description="Courriers types : modèles intégrés, ou vos propres modèles avec variables. Votre premier modèle d'un type remplace le modèle intégré par défaut."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Templates />
      </Suspense>
    </>
  );
}

async function Templates() {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const custom = await listLetterTemplates();
  return (
    <div className="flex flex-col gap-6">
      {(Object.keys(LETTER_KIND_LABELS) as LetterKind[]).map((kind) => {
        const own = custom.filter((t) => t.kind === kind);
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle>{LETTER_KIND_LABELS[kind]}</CardTitle>
              <CardDescription>{LETTER_KIND_DESCRIPTIONS[kind]}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              {own.map((template) => (
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
              {BUILTIN_TEMPLATES[kind].map((template) => (
                <div key={template.key} className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {template.name} <Badge variant="outline">Intégré</Badge>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{template.subject}</span>
                  </span>
                  <Link
                    href={`/parametres/lettres/nouveau?depuis=${template.key}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                    aria-label={`Copier le modèle ${template.name}`}
                  >
                    <CopyIcon aria-hidden />
                    Copier
                  </Link>
                </div>
              ))}
              <Link
                href={`/parametres/lettres/nouveau?type=${kind}`}
                className={buttonVariants({ variant: "outline", className: "w-fit" })}
              >
                <PlusIcon aria-hidden />
                Nouveau modèle
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
