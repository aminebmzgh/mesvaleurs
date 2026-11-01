import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMAD } from "@/lib/format";
import { listReceipts } from "@/lib/receipts/queries";

export const metadata: Metadata = { title: "Accusés de réception" };

export default function ReceiptsPage() {
  return (
    <>
      <PageHeader
        title="Accusés de réception"
        description="Remises de chèques et LCN signées à l'écran par le fournisseur ou son livreur. Pour en établir un : bouton « Faire signer » d'un chèque ou d'un lot."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Receipts />
      </Suspense>
    </>
  );
}

async function Receipts() {
  const receipts = await listReceipts();
  if (receipts.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune remise signée pour le moment.</p>;
  }
  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Accusé</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Reçu par</TableHead>
              <TableHead>Signé le</TableHead>
              <TableHead className="text-end">Valeurs</TableHead>
              <TableHead>Reçu envoyé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((receipt) => (
              <TableRow key={receipt.id}>
                <TableCell>
                  <Link href={`/paiements/accuses/${receipt.id}`} className="font-medium hover:underline">
                    {receipt.reference}
                  </Link>
                </TableCell>
                <TableCell>{receipt.supplier?.name}</TableCell>
                <TableCell>{receipt.signerName}</TableCell>
                <TableCell>{formatDateTime(receipt.signedAt)}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {receipt.count} · {formatMAD(receipt.total)}
                </TableCell>
                <TableCell>{receipt.emailedAt ? formatDateTime(receipt.emailedAt) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
