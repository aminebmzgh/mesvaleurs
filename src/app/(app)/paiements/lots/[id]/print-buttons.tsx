"use client";

import { PrinterIcon, ScanEyeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

/**
 * Impression du lot (PDF au millimètre, une page par formule) et impression test
 * sur papier blanc. Chaque impression après la première est une réimpression,
 * tracée dans le journal d'audit.
 */
export function PrintButtons({
  batchId,
  printCount,
  printedAt,
}: {
  batchId: string;
  printCount: number;
  printedAt: string | null;
}) {
  const router = useRouter();
  const reprint = printCount > 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <a
          href={`/paiements/lots/${batchId}/pdf?test=1`}
          target="_blank"
          rel="noopener"
          className={buttonVariants({ variant: "outline" })}
        >
          <ScanEyeIcon aria-hidden />
          Impression test
        </a>
        <a
          href={`/paiements/lots/${batchId}/pdf`}
          target="_blank"
          rel="noopener"
          className={buttonVariants({ variant: reprint ? "secondary" : "default" })}
          onClick={(event) => {
            if (reprint && !window.confirm("Ce lot a déjà été imprimé. Réimprimer ? La réimpression sera tracée.")) {
              event.preventDefault();
              return;
            }
            // Met à jour le compteur d'impressions affiché
            setTimeout(() => router.refresh(), 1500);
          }}
        >
          <PrinterIcon aria-hidden />
          {reprint ? "Réimprimer" : "Imprimer"}
        </a>
      </div>
      {printedAt && (
        <p className="text-xs text-muted-foreground">
          Imprimé le {formatDate(printedAt)}
          {printCount > 1 && ` · ${printCount - 1} réimpression(s)`}
        </p>
      )}
    </div>
  );
}
