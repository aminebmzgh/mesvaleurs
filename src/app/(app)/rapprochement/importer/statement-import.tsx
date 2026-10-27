"use client";

import { CircleAlertIcon, FileSpreadsheetIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMAD } from "@/lib/format";
import { extractInstrumentNumber } from "@/lib/statements/extract";
import {
  type Cell,
  type ColumnMapping,
  columnMappingSchema,
  detectHeaderRow,
  guessMapping,
  MAPPING_KEYS,
  MAPPING_LABELS,
  parseRows,
  statementPeriod,
} from "@/lib/statements/parse";
import { headerSignature, readStatementFile } from "@/lib/statements/read-file";
import { MAX_STATEMENT_LINES, STATEMENT_MAX_BYTES, statementFilePath } from "@/lib/statements/schemas";
import { createClient } from "@/lib/supabase/client";
import { importStatement, loadColumnMapping } from "../actions";

type Account = { id: string; label: string; bankName: string };
type Loaded = { file: File; rows: Cell[][]; format: "csv" | "excel"; hash: string };

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";
const cellText = (cell: Cell) => (cell === null || cell === undefined ? "" : cell instanceof Date ? cell.toLocaleDateString("fr-FR") : String(cell));

export function StatementImport({ organizationId, accounts }: { organizationId: string; accounts: Account[] }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [mappingSource, setMappingSource] = useState<"saved" | "guessed" | null>(null);
  const [readError, setReadError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const headers = loaded ? (loaded.rows[headerRow] ?? []) : [];
  const parsed = useMemo(() => (loaded && mapping ? parseRows(loaded.rows, headerRow, mapping) : null), [loaded, mapping, headerRow]);
  const period = parsed ? statementPeriod(parsed.lines) : null;
  const totals = parsed?.lines.reduce(
    (sum, line) => ({ debit: sum.debit + (line.debit ?? 0), credit: sum.credit + (line.credit ?? 0) }),
    { debit: 0, credit: 0 },
  );
  const withNumber = parsed?.lines.filter((line) => line.debit && extractInstrumentNumber(line.label)).length ?? 0;

  const onFile = (file: File) => {
    setReadError(undefined);
    setLoaded(null);
    setMapping(null);
    if (file.size > STATEMENT_MAX_BYTES) {
      setReadError("Fichier trop volumineux : 20 Mo maximum.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await readStatementFile(file);
        if (result.rows.length === 0) {
          setReadError("Le fichier est vide.");
          return;
        }
        const header = detectHeaderRow(result.rows);
        const signature = headerSignature(result.rows[header] ?? []);
        // Correspondance mémorisée pour cette banque, si le format d'export n'a pas changé
        const saved = accountId ? await loadColumnMapping(accountId) : null;
        const savedMapping = saved && saved.header_signature === signature ? columnMappingSchema.safeParse(saved.mapping) : null;
        setLoaded({ file, ...result });
        setHeaderRow(header);
        if (savedMapping?.success) {
          setMapping(savedMapping.data);
          setMappingSource("saved");
        } else {
          setMapping(guessMapping(result.rows[header] ?? []));
          setMappingSource("guessed");
        }
      } catch {
        setReadError("Impossible de lire ce fichier. Exportez le relevé en Excel (.xlsx) ou en CSV depuis votre banque en ligne.");
      }
    });
  };

  const submit = () => {
    if (!loaded || !mapping || !parsed || parsed.lines.length === 0) {
      return;
    }
    startTransition(async () => {
      // Le fichier d'origine part directement vers Supabase Storage ; le serveur ne reçoit que les lignes
      const filePath = statementFilePath(organizationId, accountId, loaded.file.name, crypto.randomUUID());
      const { error: uploadError } = await createClient().storage.from("releves").upload(filePath, loaded.file, {
        contentType: loaded.file.type || "application/octet-stream",
      });
      const result = await importStatement({
        bankAccountId: accountId,
        format: loaded.format,
        fileHash: loaded.hash,
        filePath: uploadError ? null : filePath,
        headerSignature: headerSignature(headers),
        mapping,
        lines: parsed.lines,
      });
      if (!result.ok) {
        if (!uploadError) {
          await createClient().storage.from("releves").remove([filePath]);
        }
        toast.error(result.error);
        return;
      }
      const { inserted, duplicates, autoMatched, toConfirm } = result.data;
      toast.success(
        `${inserted} ligne(s) importée(s)${duplicates ? `, ${duplicates} déjà présente(s)` : ""} · ${autoMatched} rapprochée(s), ${toConfirm} à confirmer.`,
      );
      router.push(`/rapprochement/${result.data.importId}`);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Relevé</CardTitle>
          <CardDescription>
            Export Excel (.xlsx, .xls) ou CSV téléchargé depuis votre banque en ligne. Le format est mémorisé par banque.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="account">Compte bancaire</FieldLabel>
            <select id="account" className={SELECT_CLASS} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label} · {account.bankName}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="statement-file">Fichier</FieldLabel>
            <input
              id="statement-file"
              type="file"
              accept=".csv,.txt,.xls,.xlsx"
              className="text-sm file:me-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1"
              disabled={!accountId || pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onFile(file);
                }
              }}
            />
          </Field>
          {readError && (
            <Alert variant="destructive" className="sm:col-span-2">
              <CircleAlertIcon aria-hidden />
              <AlertDescription>{readError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {loaded && mapping && parsed && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Colonnes</CardTitle>
              <CardDescription>
                {mappingSource === "saved"
                  ? "Correspondance reprise du dernier relevé de cette banque."
                  : "Correspondance proposée d'après l'en-tête : vérifiez-la."}
              </CardDescription>
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
                    setMappingSource("guessed");
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
                    <FieldLabel htmlFor={`map-${key}`}>{MAPPING_LABELS[key]}</FieldLabel>
                    <select
                      id={`map-${key}`}
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
              <FieldDescription>
                Débit et crédit en deux colonnes, ou un seul « montant signé » (négatif pour les débits).
              </FieldDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Vérification</CardTitle>
              <CardDescription>
                {parsed.lines.length} mouvement(s)
                {period && ` du ${formatDate(period.start)} au ${formatDate(period.end)}`} · débits {formatMAD(totals?.debit ?? 0)} ·
                crédits {formatMAD(totals?.credit ?? 0)} · {withNumber} débit(s) avec numéro de chèque ou de LCN
                {parsed.skipped > 0 && ` · ${parsed.skipped} ligne(s) sans date ignorée(s) (soldes, totaux)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {parsed.errors.length > 0 && (
                <Alert variant="destructive">
                  <CircleAlertIcon aria-hidden />
                  <AlertDescription>
                    {parsed.errors.length} ligne(s) non importée(s) :{" "}
                    {parsed.errors
                      .slice(0, 5)
                      .map((error) => `ligne ${error.row} (${error.message})`)
                      .join(", ")}
                    {parsed.errors.length > 5 && "…"}
                  </AlertDescription>
                </Alert>
              )}
              {parsed.lines.length > MAX_STATEMENT_LINES && (
                <Alert variant="destructive">
                  <CircleAlertIcon aria-hidden />
                  <AlertDescription>
                    Plus de {MAX_STATEMENT_LINES} lignes : exportez le relevé par période plus courte.
                  </AlertDescription>
                </Alert>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>N° détecté</TableHead>
                      <TableHead className="text-end">Débit</TableHead>
                      <TableHead className="text-end">Crédit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.lines.slice(0, 10).map((line, index) => {
                      const extracted = line.debit ? extractInstrumentNumber(line.label) : null;
                      return (
                        <TableRow key={index}>
                          <TableCell>{formatDate(line.operationDate)}</TableCell>
                          <TableCell className="max-w-96 truncate">{line.label}</TableCell>
                          <TableCell className="font-mono tabular-nums">
                            {extracted ? `${extracted.kind === "lcn" ? "LCN " : ""}${extracted.number}` : "—"}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">{line.debit ? formatMAD(line.debit) : ""}</TableCell>
                          <TableCell className="text-end tabular-nums">{line.credit ? formatMAD(line.credit) : ""}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {parsed.lines.length > 10 && (
                <p className="text-xs text-muted-foreground">… et {parsed.lines.length - 10} autre(s) mouvement(s).</p>
              )}
              <Button
                size="lg"
                className="w-fit"
                disabled={pending || parsed.lines.length === 0 || parsed.lines.length > MAX_STATEMENT_LINES}
                onClick={submit}
              >
                {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <UploadIcon aria-hidden />}
                Importer et rapprocher {parsed.lines.length} mouvement(s)
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {!loaded && !readError && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheetIcon className="size-4" aria-hidden />}
          {pending ? "Lecture du fichier…" : "Choisissez le relevé à importer."}
        </p>
      )}
    </div>
  );
}
