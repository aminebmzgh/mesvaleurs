"use client";

import { CircleAlertIcon, DownloadIcon, FilePlusIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate, formatMAD } from "@/lib/format";
import { parseReviewLines, type ReviewLine, reviewLines } from "@/lib/statements/ocr/review";
import { type Cell, type ColumnMapping, detectHeaderRow, guessMapping, MAPPING_KEYS, MAPPING_LABELS, parseRows } from "@/lib/statements/parse";
import { PdfStatementError } from "@/lib/statements/pdf/parsers";
import { type OcrProgress, readStatementFile, type StatementFile } from "@/lib/statements/read-file";
import { STATEMENT_MAX_BYTES } from "@/lib/statements/schemas";
import { MATCH_KIND_LABELS, MATCH_STATUS_LABELS } from "@/lib/suppliers/statement-export";
import { compareSupplierStatement, type MatchRow, type OurInvoice, type OurPayment } from "@/lib/suppliers/statement-match";
import { OcrReview } from "../../../rapprochement/importer/ocr-review";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";
const cellText = (cell: Cell) => (cell === null || cell === undefined ? "" : cell instanceof Date ? cell.toLocaleDateString("fr-FR") : String(cell));

const STATUS_VARIANTS: Record<MatchRow["status"], "secondary" | "outline" | "destructive"> = {
  matched: "secondary",
  amount_diff: "destructive",
  missing_ours: "destructive",
  missing_theirs: "outline",
};

export function SupplierReconciliation({
  supplierId,
  invoices,
  payments,
  canCreateInvoice,
}: {
  supplierId: string;
  invoices: OurInvoice[];
  payments: OurPayment[];
  canCreateInvoice: boolean;
}) {
  const [loaded, setLoaded] = useState<StatementFile | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [swapSides, setSwapSides] = useState(false);
  const [onlyGaps, setOnlyGaps] = useState(true);
  const [readError, setReadError] = useState<string>();
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [edits, setEdits] = useState<{ key: string; lines: ReviewLine[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const [exporting, startExport] = useTransition();

  const headers = loaded ? (loaded.rows[headerRow] ?? []) : [];
  const reviewKey = loaded && mapping ? `${loaded.hash}|${headerRow}|${JSON.stringify(mapping)}` : "";
  const initialReview = useMemo(
    () => (loaded?.scan && mapping ? reviewLines(loaded.rows, headerRow, mapping, loaded.scan.uncertain) : null),
    [loaded, mapping, headerRow],
  );
  const review = edits && edits.key === reviewKey ? edits.lines : initialReview;
  const reviewed = useMemo(() => (review ? parseReviewLines(review) : null), [review]);
  const lines = useMemo(
    () => (loaded && mapping ? (loaded.scan ? (reviewed?.lines ?? []) : parseRows(loaded.rows, headerRow, mapping).lines) : []),
    [loaded, mapping, headerRow, reviewed],
  );
  const comparison = useMemo(
    () => (lines.length > 0 ? compareSupplierStatement(lines, invoices, payments, { swapSides }) : null),
    [lines, invoices, payments, swapSides],
  );
  const gaps = comparison?.rows.filter((row) => row.status !== "matched") ?? [];
  const shown = onlyGaps ? gaps : (comparison?.rows ?? []);

  const onFile = (file: File) => {
    setReadError(undefined);
    loaded?.scan?.pages.forEach((url) => URL.revokeObjectURL(url));
    setLoaded(null);
    setMapping(null);
    setEdits(null);
    if (file.size > STATEMENT_MAX_BYTES) {
      setReadError("Fichier trop volumineux : 20 Mo maximum.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await readStatementFile(file, setOcrProgress);
        if (result.rows.length === 0) {
          setReadError("Le fichier est vide.");
          return;
        }
        const header = detectHeaderRow(result.rows);
        setLoaded(result);
        setHeaderRow(header);
        setMapping(guessMapping(result.rows[header] ?? []));
      } catch (error) {
        setReadError(
          error instanceof PdfStatementError ? error.message : "Impossible de lire ce fichier. Importez un relevé PDF, Excel, CSV, ou une photo.",
        );
      } finally {
        setOcrProgress(null);
      }
    });
  };

  const download = (format: "csv" | "xlsx" | "pdf") => {
    if (!comparison) {
      return;
    }
    startExport(async () => {
      const response = await fetch(`/fournisseurs/${supplierId}/rapprochement/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, period: comparison.period, totals: comparison.totals, rows: comparison.rows }),
      });
      if (!response.ok) {
        toast.error("Export impossible.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `rapprochement-fournisseur.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Relevé du fournisseur</CardTitle>
          <CardDescription>
            Excel, CSV, PDF, ou relevé papier scanné ou photographié (lu dans votre navigateur). Le fichier n&apos;est pas conservé.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field className="max-w-md">
            <FieldLabel htmlFor="supplier-statement">Fichier</FieldLabel>
            <input
              id="supplier-statement"
              type="file"
              accept=".pdf,.csv,.txt,.xls,.xlsx,.jpg,.jpeg,.png"
              className="text-sm file:me-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onFile(file);
                }
              }}
            />
          </Field>
          {pending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              {ocrProgress
                ? `Lecture du scan, page ${ocrProgress.page} sur ${ocrProgress.pages} : ${Math.round(ocrProgress.ratio * 100)} %…`
                : "Lecture du fichier…"}
            </p>
          )}
          {readError && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertDescription>{readError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {loaded && mapping && (
        <Card>
          <CardHeader>
            <CardTitle>2. Colonnes</CardTitle>
            <CardDescription>Correspondance proposée d&apos;après l&apos;en-tête : vérifiez-la.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field className="max-w-xs">
              <FieldLabel htmlFor="header-row">Ligne d&apos;en-tête</FieldLabel>
              <select
                id="header-row"
                className={SELECT_CLASS}
                value={headerRow}
                onChange={(event) => {
                  const row = Number(event.target.value);
                  setHeaderRow(row);
                  setMapping(guessMapping(loaded.rows[row] ?? []));
                }}
              >
                {loaded.rows.slice(0, 30).map((row, index) => (
                  <option key={index} value={index}>
                    Ligne {index + 1} : {row.map(cellText).filter(Boolean).join(" · ").slice(0, 60) || "(vide)"}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MAPPING_KEYS.map((key) => (
                <Field key={key}>
                  <FieldLabel htmlFor={`map-${key}`}>{key === "reference" ? "Pièce (n° de facture)" : MAPPING_LABELS[key]}</FieldLabel>
                  <select
                    id={`map-${key}`}
                    className={SELECT_CLASS}
                    value={mapping[key] ?? ""}
                    onChange={(event) => setMapping({ ...mapping, [key]: event.target.value === "" ? null : Number(event.target.value) })}
                  >
                    <option value="">— Aucune —</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>
                        {cellText(header) || `Colonne ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={swapSides}
                onChange={(event) => setSwapSides(event.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              Le relevé porte les factures au crédit et nos règlements au débit
            </label>
            {loaded.scan && review && reviewed && (
              <OcrReview lines={review} errors={reviewed.errors} pages={loaded.scan.pages} onChange={(next) => setEdits({ key: reviewKey, lines: next })} />
            )}
          </CardContent>
        </Card>
      )}

      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle>3. Écarts</CardTitle>
            <CardDescription>
              {comparison.period && `Du ${formatDate(comparison.period.start)} au ${formatDate(comparison.period.end)} · `}
              {comparison.rows.length - gaps.length} ligne(s) concordante(s), {gaps.length} écart(s)
              {comparison.skipped > 0 && ` · ${comparison.skipped} ligne(s) de solde ou de report écartée(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <section aria-label="Soldes de la période" className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Selon le fournisseur", value: comparison.totals.theirs },
                { label: "Selon nos livres", value: comparison.totals.ours },
                { label: "Écart", value: comparison.totals.difference, alert: comparison.totals.difference !== 0 },
              ].map((card) => (
                <Card key={card.label} size="sm">
                  <CardHeader>
                    <CardDescription>{card.label}</CardDescription>
                    <CardTitle className={`text-xl tabular-nums ${card.alert ? "text-destructive" : ""}`}>{formatMAD(card.value)}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyGaps} onChange={(event) => setOnlyGaps(event.target.checked)} className="size-4 accent-primary" />
                Écarts seulement
              </label>
              <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                {exporting ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <DownloadIcon className="size-4" aria-hidden />}
                <span>Exporter le rapport :</span>
                {(["xlsx", "pdf", "csv"] as const).map((format) => (
                  <Button key={format} variant="ghost" size="sm" disabled={exporting} onClick={() => download(format)}>
                    {format === "xlsx" ? "Excel" : format.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun écart : le relevé du fournisseur concorde avec nos livres.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table aria-label="Rapprochement avec le relevé du fournisseur">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Situation</TableHead>
                      <TableHead>Relevé du fournisseur</TableHead>
                      <TableHead className="text-end">Montant</TableHead>
                      <TableHead>Nos livres</TableHead>
                      <TableHead className="text-end">Montant</TableHead>
                      <TableHead className="text-end">Écart</TableHead>
                      <TableHead>
                        <span className="sr-only">Action</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((row, index) => (
                      <TableRow key={index} aria-label={`${MATCH_KIND_LABELS[row.kind]} ${row.theirs?.reference ?? row.theirs?.label ?? row.ours?.label}`}>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[row.status]}>{MATCH_STATUS_LABELS[row.status]}</Badge>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {MATCH_KIND_LABELS[row.kind]}
                            {row.probable && " · d'après le montant et la date"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.theirs ? (
                            <>
                              <div>{[row.theirs.reference, row.theirs.label].filter(Boolean).join(" · ")}</div>
                              <div className="text-xs text-muted-foreground">le {formatDate(row.theirs.date)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{row.theirs ? formatMAD(row.theirs.amount) : ""}</TableCell>
                        <TableCell>
                          {row.ours ? (
                            <>
                              <Link
                                href={row.kind === "invoice" ? `/factures/${row.ours.id}` : `/paiements/${row.ours.id}`}
                                className="font-medium hover:underline"
                              >
                                {row.ours.label}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                le {formatDate(row.ours.date)}
                                {row.status === "missing_theirs" &&
                                  row.kind === "payment" &&
                                  !payments.find((payment) => payment.id === row.ours!.id)?.delivered &&
                                  " · pas encore remis au fournisseur"}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{row.ours ? formatMAD(row.ours.amount) : ""}</TableCell>
                        <TableCell className={`text-end tabular-nums ${row.difference !== 0 ? "text-destructive" : ""}`}>
                          {row.difference === 0 ? "—" : `${row.difference > 0 ? "+" : "−"}${formatAmount(Math.abs(row.difference))}`}
                        </TableCell>
                        <TableCell>
                          {canCreateInvoice && row.status === "missing_ours" && row.kind === "invoice" && row.theirs && (
                            <Link
                              href={`/factures/nouvelle?${new URLSearchParams({
                                fournisseur: supplierId,
                                numero: row.theirs.reference ?? row.theirs.label,
                                date: row.theirs.date,
                                ttc: String(row.theirs.amount),
                              })}`}
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              <FilePlusIcon aria-hidden />
                              Créer la facture
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
