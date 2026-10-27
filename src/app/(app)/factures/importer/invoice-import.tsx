"use client";

import { CircleAlertIcon, CircleCheckIcon, Loader2Icon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMAD } from "@/lib/format";
import {
  detectInvoiceHeaderRow,
  guessInvoiceMapping,
  INVOICE_MAPPING_KEYS,
  INVOICE_MAPPING_LABELS,
  type InvoiceMapping,
  parseInvoiceRows,
} from "@/lib/invoices/import";
import type { Cell } from "@/lib/statements/parse";
import { readStatementFile } from "@/lib/statements/read-file";
import { importInvoices, type InvoiceImportReport } from "./actions";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";
const cellText = (cell: Cell) => (cell === null || cell === undefined ? "" : cell instanceof Date ? cell.toLocaleDateString("fr-FR") : String(cell));

export function InvoiceImport() {
  const [rows, setRows] = useState<Cell[][] | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<InvoiceMapping | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [readError, setReadError] = useState<string>();
  const [report, setReport] = useState<InvoiceImportReport | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => (rows && mapping ? parseInvoiceRows(rows, headerRow, mapping) : null), [rows, mapping, headerRow]);
  const headers = rows?.[headerRow] ?? [];
  const total = parsed?.rows.reduce((sum, row) => sum + row.amountInclTax, 0) ?? 0;

  const onFile = (file: File) => {
    setReadError(undefined);
    setReport(null);
    startTransition(async () => {
      try {
        const result = await readStatementFile(file);
        const header = detectInvoiceHeaderRow(result.rows);
        setRows(result.rows);
        setHeaderRow(header);
        setMapping(guessInvoiceMapping(result.rows[header] ?? []));
      } catch {
        setReadError("Impossible de lire ce fichier : enregistrez-le en Excel (.xlsx) ou en CSV.");
      }
    });
  };

  const submit = () => {
    if (!parsed || parsed.rows.length === 0) {
      return;
    }
    startTransition(async () => {
      const result = await importInvoices({ rows: parsed.rows, createMissingSuppliers: createMissing });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReport(result.data);
      toast.success(`${result.data.inserted} facture(s) importée(s).`);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Fichier</CardTitle>
          <CardDescription>
            Une ligne par facture : fournisseur (raison sociale ou ICE), numéro, date et montant TTC (ou HT + TVA).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field className="max-w-md">
            <FieldLabel htmlFor="invoice-file">Fichier Excel ou CSV</FieldLabel>
            <input
              id="invoice-file"
              type="file"
              accept=".csv,.txt,.xls,.xlsx"
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
          {readError && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertDescription>{readError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {rows && mapping && parsed && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Colonnes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field className="max-w-xs">
                <FieldLabel htmlFor="invoice-header-row">Ligne d&apos;en-tête</FieldLabel>
                <select
                  id="invoice-header-row"
                  className={SELECT_CLASS}
                  value={headerRow}
                  onChange={(event) => {
                    const row = Number(event.target.value);
                    setHeaderRow(row);
                    setMapping(guessInvoiceMapping(rows[row] ?? []));
                  }}
                >
                  {rows.slice(0, 30).map((row, index) => (
                    <option key={index} value={index}>
                      Ligne {index + 1} : {row.map(cellText).filter(Boolean).join(" · ").slice(0, 60) || "(vide)"}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {INVOICE_MAPPING_KEYS.map((key) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`invoice-map-${key}`}>{INVOICE_MAPPING_LABELS[key]}</FieldLabel>
                    <select
                      id={`invoice-map-${key}`}
                      className={SELECT_CLASS}
                      value={mapping[key] ?? ""}
                      onChange={(event) =>
                        setMapping({ ...mapping, [key]: event.target.value === "" ? null : Number(event.target.value) })
                      }
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Vérification</CardTitle>
              <CardDescription>
                {parsed.rows.length} facture(s) valide(s) · total TTC {formatMAD(total)}
                {parsed.errors.length > 0 && ` · ${parsed.errors.length} ligne(s) en erreur`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {parsed.errors.length > 0 && (
                <Alert variant="destructive">
                  <CircleAlertIcon aria-hidden />
                  <AlertTitle>Lignes non importées</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc ps-5">
                      {parsed.errors.slice(0, 8).map((error) => (
                        <li key={error.line}>
                          Ligne {error.line} : {error.message}
                        </li>
                      ))}
                    </ul>
                    {parsed.errors.length > 8 && <span>… et {parsed.errors.length - 8} autre(s).</span>}
                  </AlertDescription>
                </Alert>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-end">TTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.rows.slice(0, 10).map((row) => (
                      <TableRow key={row.line}>
                        <TableCell>
                          {row.supplierName}
                          {row.supplierIce && <span className="block font-mono text-xs text-muted-foreground">ICE {row.supplierIce}</span>}
                        </TableCell>
                        <TableCell>{row.number}</TableCell>
                        <TableCell>{formatDate(row.issueDate)}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatMAD(row.amountInclTax)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={createMissing}
                  onChange={(event) => setCreateMissing(event.target.checked)}
                />
                Créer les fournisseurs inconnus (reconnus par ICE, sinon par raison sociale)
              </label>
              <Button size="lg" className="w-fit" disabled={pending || parsed.rows.length === 0} onClick={submit}>
                {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <UploadIcon aria-hidden />}
                Importer {parsed.rows.length} facture(s)
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {report && (
        <Alert>
          <CircleCheckIcon aria-hidden />
          <AlertTitle>Import terminé</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              {report.inserted} facture(s) importée(s) · {report.alreadyPresent} déjà présente(s) · {report.createdSuppliers}{" "}
              fournisseur(s) créé(s)
            </span>
            {report.unknownSuppliers.length > 0 && (
              <span>
                Fournisseurs inconnus, factures non importées :{" "}
                {report.unknownSuppliers
                  .slice(0, 10)
                  .map((u) => `ligne ${u.line} (${u.supplier})`)
                  .join(", ")}
              </span>
            )}
            <Link href="/factures" className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}>
              Voir les factures
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
