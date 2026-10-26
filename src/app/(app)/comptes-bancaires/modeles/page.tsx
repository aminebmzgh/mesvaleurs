import { ArrowLeftIcon, FileImageIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { DEFAULT_TEMPLATES, GENERIC_TEMPLATES } from "@/lib/printing/default-templates";
import { listTemplates } from "@/lib/printing/queries";
import { createTemplate } from "./actions";

export const metadata: Metadata = { title: "Modèles d'impression" };

export default function TemplatesPage() {
  return (
    <>
      <Link href="/comptes-bancaires" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeftIcon aria-hidden />
        Comptes et chéquiers
      </Link>
      <PageHeader
        title="Modèles d'impression"
        description="Position de chaque mention sur vos formules de chèques et de LCN, au millimètre."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Templates />
      </Suspense>
    </>
  );
}

async function Templates() {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const templates = await listTemplates();
  const sources = [...DEFAULT_TEMPLATES, GENERIC_TEMPLATES.check, GENERIC_TEMPLATES.lcn];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Vos modèles</CardTitle>
          <CardDescription>
            Sans modèle choisi, un carnet est imprimé avec le modèle par défaut de sa banque. Associez un modèle à un carnet
            depuis la fiche du compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <EmptyState
              icon={FileImageIcon}
              title="Aucun modèle personnalisé"
              description="Partez d'un modèle par défaut ci-dessous, puis ajustez-le à votre formule et à votre imprimante."
            />
          ) : (
            <ul className="divide-y">
              {templates.map((template) => (
                <li key={template.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Link href={`/comptes-bancaires/modeles/${template.id}`} className="font-medium hover:underline">
                      {template.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {template.widthMm} × {template.heightMm} mm · décalage {template.offsetXMm} / {template.offsetYMm} mm
                      {template.bankName && ` · ${template.bankName}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{template.type === "check" ? "Chèque" : "LCN"}</Badge>
                    {!template.backgroundPath && <Badge variant="outline">Sans scan</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Créer à partir d&apos;un modèle par défaut</CardTitle>
          <CardDescription>
            Relevés sur des formules réelles (chèques 175 × 80 mm, LCN 200 × 105 mm), à ±2 mm : ajustez-les avec
            l&apos;impression test.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sources.map((source) => (
            <form key={source.key} action={createTemplate.bind(null, source.key)}>
              <Button type="submit" variant="outline" className="h-auto w-full flex-col items-start gap-1 py-3 text-start whitespace-normal">
                <span className="font-medium">{source.name}</span>
                <span className="text-xs text-muted-foreground">
                  {source.widthMm} × {source.heightMm} mm · {source.zones.length} zones
                </span>
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
