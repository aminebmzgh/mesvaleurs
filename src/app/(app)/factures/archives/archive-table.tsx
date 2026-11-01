"use client";

import { FileCodeIcon, FileIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMAD } from "@/lib/format";
import type { ArchiveCheck } from "@/lib/invoices/archives";
import { verifyArchives } from "./actions";

export type ArchiveRow = {
  id: string;
  kind: "ubl" | "attachment";
  sha256: string | null;
  archivedAt: string;
  retainUntil: string;
  url: string | null;
  invoice: { id: string; number: string; issueDate: string; amount: number; supplier: string; ice: string | null };
};

const CHECK_LABELS: Record<ArchiveCheck["status"], { label: string; variant: "secondary" | "destructive" | "outline" }> = {
  intact: { label: "Intègre", variant: "secondary" },
  sealed: { label: "Empreinte scellée", variant: "outline" },
  altered: { label: "Modifiée !", variant: "destructive" },
  missing: { label: "Fichier introuvable", variant: "destructive" },
};

/** Registre des archives, avec vérification d'intégrité des pièces affichées. */
export function ArchiveTable({ rows }: { rows: ArchiveRow[] }) {
  const [checks, setChecks] = useState<Map<string, ArchiveCheck["status"]>>(new Map());
  const [pending, startTransition] = useTransition();

  const verify = () =>
    startTransition(async () => {
      const result = await verifyArchives(rows.map((row) => row.id));
      if (result.error || !result.results) {
        toast.error(result.error ?? "Vérification impossible.");
        return;
      }
      setChecks(new Map(result.results.map((check) => [check.id, check.status])));
      const problems = result.results.filter((check) => check.status === "altered" || check.status === "missing").length;
      if (problems > 0) {
        toast.error(`${problems} pièce(s) non conforme(s) : contactez le support.`);
      } else {
        toast.success(`${result.results.length} pièce(s) vérifiée(s) : toutes intègres.`);
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" className="w-fit" disabled={pending || rows.length === 0} onClick={verify}>
        {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <ShieldCheckIcon aria-hidden />}
        Vérifier l&apos;intégrité des pièces affichées
      </Button>
      <div className="overflow-x-auto">
        <Table aria-label="Registre des archives">
          <TableHeader>
            <TableRow>
              <TableHead>Facture</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead className="text-end">Montant TTC</TableHead>
              <TableHead>Pièce</TableHead>
              <TableHead>Archivée le</TableHead>
              <TableHead>Conservée jusqu&apos;au</TableHead>
              <TableHead>Empreinte SHA-256</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const check = checks.get(row.id);
              return (
                <TableRow key={row.id} aria-label={`Archive ${row.invoice.number}`}>
                  <TableCell>
                    <Link href={`/factures/${row.invoice.id}`} className="font-medium hover:underline">
                      {row.invoice.number}
                    </Link>
                    <div className="text-xs text-muted-foreground">du {formatDate(row.invoice.issueDate)}</div>
                  </TableCell>
                  <TableCell>
                    {row.invoice.supplier}
                    {row.invoice.ice && <div className="font-mono text-xs text-muted-foreground">ICE {row.invoice.ice}</div>}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{formatMAD(row.invoice.amount)}</TableCell>
                  <TableCell>
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                        {row.kind === "ubl" ? <FileCodeIcon className="size-4" aria-hidden /> : <FileIcon className="size-4" aria-hidden />}
                        {row.kind === "ubl" ? "Facture UBL" : "Pièce jointe"}
                      </a>
                    ) : row.kind === "ubl" ? (
                      "Facture UBL"
                    ) : (
                      "Pièce jointe"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(row.archivedAt.slice(0, 10))}</TableCell>
                  <TableCell>{formatDate(row.retainUntil)}</TableCell>
                  <TableCell>
                    {row.sha256 ? (
                      <span className="font-mono text-xs" title={row.sha256}>
                        {row.sha256.slice(0, 12)}…
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">à sceller</span>
                    )}
                    {check && (
                      <Badge variant={CHECK_LABELS[check].variant} className="ms-2">
                        {CHECK_LABELS[check].label}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
