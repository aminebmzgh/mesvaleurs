import { GitCompareArrowsIcon, UploadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import { listImports } from "@/lib/statements/queries";

export const metadata: Metadata = { title: "Rapprochement bancaire" };

export default function ReconciliationPage() {
  return (
    <>
      <PageHeader
        title="Rapprochement bancaire"
        description="Relevés importés et rapprochement avec les chèques et LCN émis."
        actions={
          <Suspense>
            <ImportButton />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Imports />
      </Suspense>
    </>
  );
}

async function ImportButton() {
  const organization = await requireActiveOrganization();
  if (!ACCOUNT_MANAGER_ROLES.includes(organization.role)) {
    return null;
  }
  return (
    <Link href="/rapprochement/importer" className={buttonVariants()}>
      <UploadIcon aria-hidden />
      Importer un relevé
    </Link>
  );
}

async function Imports() {
  const imports = await listImports();
  if (imports.length === 0) {
    return (
      <EmptyState
        icon={GitCompareArrowsIcon}
        title="Aucun relevé importé"
        description="Importez le relevé Excel ou CSV de votre banque : les chèques et LCN débités seront rapprochés automatiquement."
      />
    );
  }
  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compte</TableHead>
              <TableHead>Période</TableHead>
              <TableHead>Importé le</TableHead>
              <TableHead className="text-end">Lignes</TableHead>
              <TableHead className="text-end">Rapprochées</TableHead>
              <TableHead className="text-end">À confirmer</TableHead>
              <TableHead className="text-end">Débits à traiter</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {imports.map((statementImport) => (
              <TableRow key={statementImport.id}>
                <TableCell>
                  <Link href={`/rapprochement/${statementImport.id}`} className="font-medium hover:underline">
                    {statementImport.bank_accounts?.label}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{statementImport.bank_accounts?.banks?.name}</span>
                </TableCell>
                <TableCell>
                  {statementImport.period_start && statementImport.period_end
                    ? `${formatDate(statementImport.period_start)} → ${formatDate(statementImport.period_end)}`
                    : "—"}
                </TableCell>
                <TableCell>{formatDate(statementImport.created_at)}</TableCell>
                <TableCell className="text-end tabular-nums">{statementImport.line_count}</TableCell>
                <TableCell className="text-end tabular-nums">{statementImport.matched}</TableCell>
                <TableCell className="text-end tabular-nums">{statementImport.toConfirm}</TableCell>
                <TableCell className="text-end tabular-nums">{statementImport.unmatchedDebits}</TableCell>
                <TableCell>
                  <Badge variant={statementImport.status === "completed" ? "default" : "secondary"}>
                    {statementImport.status === "completed" ? "Terminé" : "À vérifier"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
