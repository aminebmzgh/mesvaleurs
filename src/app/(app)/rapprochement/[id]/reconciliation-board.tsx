"use client";

import { CheckIcon, EyeOffIcon, Link2Icon, RotateCcwIcon, Undo2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMAD } from "@/lib/format";
import { paymentLabel } from "@/lib/payments/label";
import type { ImportDetail, LineStatus } from "@/lib/statements/queries";
import { cn } from "@/lib/utils";
import { type ActionResult, confirmLine, setLineIgnored, unmatchLine } from "../actions";

type Line = ImportDetail["lines"][number];
type Payment = ImportDetail["payments"][number];
type Filter = "todo" | "matched" | "ignored" | "all";

const STATUS: Record<LineStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  auto_matched: { label: "Rapprochée", variant: "default" },
  manually_matched: { label: "Rapprochée (manuel)", variant: "default" },
  to_confirm: { label: "À confirmer", variant: "secondary" },
  unmatched: { label: "Non rapprochée", variant: "outline" },
  ignored: { label: "Ignorée", variant: "outline" },
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todo", label: "À traiter" },
  { value: "matched", label: "Rapprochées" },
  { value: "ignored", label: "Ignorées" },
  { value: "all", label: "Toutes" },
];

const isTodo = (line: Line) => line.status === "to_confirm" || (line.status === "unmatched" && (line.debit ?? 0) > 0);
const isMatched = (line: Line) => line.status === "auto_matched" || line.status === "manually_matched";

/**
 * Écran de rapprochement en deux colonnes : lignes du relevé ↔ chèques et LCN en
 * circulation. Validation en un clic, rapprochement manuel par sélection ou par
 * glisser-déposer d'un paiement sur une ligne.
 */
export function ReconciliationBoard({ detail, canEdit }: { detail: ImportDetail; canEdit: boolean }) {
  const [filter, setFilter] = useState<Filter>(detail.lines.some(isTodo) ? "todo" : "all");
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(success);
        setSelectedLine(null);
      }
    });

  const lines = detail.lines.filter((line) =>
    filter === "todo" ? isTodo(line) : filter === "matched" ? isMatched(line) : filter === "ignored" ? line.status === "ignored" : true,
  );
  const selected = detail.lines.find((line) => line.id === selectedLine);
  // Les paiements déjà proposés pour une autre ligne restent rapprochables : la confirmation tranche
  const payments = detail.payments;

  const matchPayment = (lineId: string, payment: Payment) => {
    const line = detail.lines.find((l) => l.id === lineId);
    if (!line || !line.debit) {
      toast.error("Seul un débit peut être rapproché d'un chèque ou d'une LCN.");
      return;
    }
    if (Math.round(line.debit * 100) !== Math.round(payment.amount * 100) &&
      !window.confirm(`Montants différents : relevé ${formatMAD(line.debit)}, paiement ${formatMAD(payment.amount)}. Rapprocher quand même ?`)) {
      return;
    }
    run(() => confirmLine(lineId, payment.id), `${paymentLabel(payment)} rapproché.`);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Lignes du relevé</CardTitle>
          <div role="tablist" aria-label="Filtrer les lignes" className="flex flex-wrap gap-1">
            {FILTERS.map((item) => (
              <Button
                key={item.value}
                role="tab"
                aria-selected={filter === item.value}
                size="sm"
                variant={filter === item.value ? "secondary" : "ghost"}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span className="text-muted-foreground tabular-nums">
                  {item.value === "todo"
                    ? detail.lines.filter(isTodo).length
                    : item.value === "matched"
                      ? detail.lines.filter(isMatched).length
                      : item.value === "ignored"
                        ? detail.lines.filter((l) => l.status === "ignored").length
                        : detail.lines.length}
                </span>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {lines.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {filter === "todo" ? "Tout est rapproché : rien à traiter." : "Aucune ligne."}
            </p>
          )}
          {lines.map((line) => {
            const proposal = line.payments;
            const status = STATUS[line.status as LineStatus];
            return (
              <div
                key={line.id}
                data-testid={`line-${line.id}`}
                aria-label={`Ligne ${line.label}`}
                onDragOver={(event) => {
                  if (canEdit && (line.status === "unmatched" || line.status === "to_confirm") && line.debit) {
                    event.preventDefault();
                    setDragOver(line.id);
                  }
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(null);
                  const payment = payments.find((p) => p.id === event.dataTransfer.getData("text/payment-id"));
                  if (payment) {
                    matchPayment(line.id, payment);
                  }
                }}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
                  selectedLine === line.id && "border-primary bg-primary/5",
                  dragOver === line.id && "border-primary border-dashed bg-primary/10",
                )}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDate(line.operation_date)}</span>
                    <span className="truncate font-medium">{line.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {line.confidence != null && line.status !== "ignored" && (
                      <span className="text-muted-foreground">confiance {Math.round(line.confidence)} %</span>
                    )}
                    {proposal && (
                      <span>
                        → {paymentLabel(proposal)} · {proposal.suppliers?.name} · {formatMAD(proposal.amount)}
                      </span>
                    )}
                    {line.match_reason && <span className="text-muted-foreground">({line.match_reason})</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("tabular-nums font-medium", line.credit ? "text-emerald-700 dark:text-emerald-400" : "")}>
                    {line.debit ? `−${formatMAD(line.debit)}` : `+${formatMAD(line.credit ?? 0)}`}
                  </span>
                  {canEdit && line.status === "to_confirm" && proposal && (
                    <Button size="sm" disabled={pending} onClick={() => run(() => confirmLine(line.id, proposal.id), "Rapprochement confirmé.")}>
                      <CheckIcon aria-hidden />
                      Confirmer
                    </Button>
                  )}
                  {canEdit && (line.status === "unmatched" || line.status === "to_confirm") && (line.debit ?? 0) > 0 && (
                    <Button
                      size="sm"
                      variant={selectedLine === line.id ? "secondary" : "outline"}
                      onClick={() => setSelectedLine(selectedLine === line.id ? null : line.id)}
                    >
                      <Link2Icon aria-hidden />
                      {selectedLine === line.id ? "Choisissez →" : "Associer"}
                    </Button>
                  )}
                  {canEdit && isMatched(line) && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => unmatchLine(line.id), "Rapprochement défait.")}>
                      <Undo2Icon aria-hidden />
                      Défaire
                    </Button>
                  )}
                  {canEdit && (line.status === "unmatched" || line.status === "to_confirm") && (
                    <Button size="sm" variant="ghost" aria-label="Ignorer la ligne" disabled={pending} onClick={() => run(() => setLineIgnored(line.id, true), "Ligne ignorée.")}>
                      <EyeOffIcon aria-hidden />
                    </Button>
                  )}
                  {canEdit && line.status === "ignored" && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setLineIgnored(line.id, false), "Ligne à traiter de nouveau.")}>
                      <RotateCcwIcon aria-hidden />
                      Rétablir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="xl:sticky xl:top-4 xl:self-start">
        <CardHeader>
          <CardTitle>Chèques et LCN en circulation</CardTitle>
          <CardDescription>
            {selected
              ? `Associer à « ${selected.label} » (${formatMAD(selected.debit ?? 0)}) : cliquez un paiement.`
              : canEdit
                ? "Glissez un paiement sur une ligne, ou cliquez « Associer » sur la ligne."
                : "Paiements émis non encore débités sur ce compte."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
          {payments.length === 0 && <p className="text-sm text-muted-foreground">Aucun paiement en circulation.</p>}
          {payments.map((payment) => {
            const sameAmount = selected?.debit != null && Math.round(selected.debit * 100) === Math.round(payment.amount * 100);
            return (
              <button
                key={payment.id}
                type="button"
                draggable={canEdit}
                disabled={!canEdit || pending}
                onDragStart={(event) => event.dataTransfer.setData("text/payment-id", payment.id)}
                onClick={() => selected && matchPayment(selected.id, payment)}
                aria-label={`${paymentLabel(payment)} ${payment.suppliers?.name ?? ""} ${formatMAD(payment.amount)}`}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border p-2 text-start text-sm",
                  canEdit && "cursor-grab active:cursor-grabbing",
                  selected ? "hover:border-primary hover:bg-primary/5" : "",
                  sameAmount && "border-primary/60 bg-primary/5",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono text-xs tabular-nums">{paymentLabel(payment)}</span>
                  <span className="truncate">{payment.suppliers?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    émis le {formatDate(payment.issue_date)}
                    {payment.due_date && ` · échéance ${formatDate(payment.due_date)}`}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums font-medium">{formatMAD(payment.amount)}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
