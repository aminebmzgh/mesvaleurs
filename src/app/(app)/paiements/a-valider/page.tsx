import { ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireActiveOrganization, requireUser } from "@/lib/auth/dal";
import { formatInstrumentNumber } from "@/lib/checkbooks";
import { formatDate, formatMAD } from "@/lib/format";
import { PAYMENT_TYPE_LABELS } from "@/lib/labels";
import { approvalReasonLabel, canDecideBatch, parseApprovalReasons } from "@/lib/payments/approvals";
import { listPendingBatches } from "@/lib/payments/list";
import { ApprovalActions } from "./approval-actions";

export const metadata: Metadata = { title: "Lots à valider" };

export default function PendingBatchesPage() {
  return (
    <>
      <PageHeader
        title="Lots à valider"
        description="Double signature : un lot au-delà du seuil ou d'un plafond est validé par un gestionnaire ou un administrateur, autre que le préparateur, avant impression."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <PendingList />
      </Suspense>
    </>
  );
}

async function PendingList() {
  const [organization, user, batches] = await Promise.all([requireActiveOrganization(), requireUser(), listPendingBatches()]);
  if (batches.length === 0) {
    return <EmptyState icon={ShieldCheckIcon} title="Aucun lot à valider" description="Les lots soumis à validation apparaîtront ici." />;
  }
  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lot</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Préparé</TableHead>
              <TableHead className="text-end">Total</TableHead>
              <TableHead>Motifs</TableHead>
              <TableHead className="text-end">Décision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => {
              const payments = [...batch.payments].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
              const first = payments[0];
              const width = first?.checkbooks?.number_width ?? 7;
              const numbers = first
                ? `${formatInstrumentNumber(first.number!, width)}${payments.length > 1 ? ` à ${formatInstrumentNumber(payments.at(-1)!.number!, width)}` : ""}`
                : "—";
              const label = first ? `${payments.length} ${PAYMENT_TYPE_LABELS[first.type].toLowerCase()} n° ${numbers}` : "Lot vide";
              return (
                <TableRow key={batch.id}>
                  <TableCell>
                    <Link href={`/paiements/lots/${batch.id}`} className="font-medium hover:underline">
                      {label}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{first?.bank_accounts?.label}</span>
                  </TableCell>
                  <TableCell>{first?.suppliers?.name}</TableCell>
                  <TableCell>
                    {formatDate(batch.created_at)}
                    <span className="block text-xs text-muted-foreground">{batch.preparedByName}</span>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(payments.reduce((sum, p) => sum + p.amount, 0))}</TableCell>
                  <TableCell className="max-w-80 text-xs">
                    {parseApprovalReasons(batch.approval_reasons).map((reason) => (
                      <span key={reason.kind} className="block">
                        {approvalReasonLabel(reason)}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {canDecideBatch(organization.role, user.id, batch.created_by) ? (
                        <ApprovalActions batchId={batch.id} label={`le lot ${numbers}`} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {batch.created_by === user.id ? "Votre lot : validation par une autre personne" : "Réservé aux gestionnaires"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
