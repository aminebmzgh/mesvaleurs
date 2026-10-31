"use client";

import { CircleAlertIcon, CircleCheckIcon, FileCodeIcon, Loader2Icon, TriangleAlertIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMAD } from "@/lib/format";
import { attachmentPath } from "@/lib/invoices/schemas";
import { checkUbl, parseUbl, UBL_MAX_BYTES, type UblCheck, UblError, type UblInvoice } from "@/lib/invoices/ubl";
import { createClient } from "@/lib/supabase/client";
import { importUbl, matchUbl, type UblMatch } from "./actions";

type Entry = {
  key: string;
  file: File;
  invoice: UblInvoice | null;
  match: UblMatch | null;
  checks: UblCheck[];
  /** Fournisseur inconnu : création confirmée par l'utilisateur. */
  createSupplier: boolean;
  result: { invoiceId?: string; error?: string } | null;
};

const MAX_FILES = 50;

export function UblImport({ organizationId }: { organizationId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [reading, startReading] = useTransition();
  const [importing, startImport] = useTransition();

  const ready = (entry: Entry) =>
    entry.invoice !== null &&
    entry.result?.invoiceId === undefined &&
    !entry.checks.some((check) => check.level === "error") &&
    (entry.match?.supplier !== null || entry.createSupplier);
  const importable = entries.filter(ready);

  const onFiles = (files: File[]) =>
    startReading(async () => {
      const parsed: Entry[] = await Promise.all(
        files.slice(0, MAX_FILES).map(async (file) => {
          const base = { key: crypto.randomUUID(), file, match: null, createSupplier: false, result: null };
          if (file.size > UBL_MAX_BYTES) {
            return { ...base, invoice: null, checks: [{ level: "error" as const, message: "Fichier trop volumineux (2 Mo maximum)." }] };
          }
          try {
            return { ...base, invoice: parseUbl(await file.text()), checks: [] };
          } catch (error) {
            return { ...base, invoice: null, checks: [{ level: "error" as const, message: error instanceof UblError ? error.message : "Fichier illisible." }] };
          }
        }),
      );
      const readable = parsed.filter((entry) => entry.invoice);
      const response = await matchUbl(
        readable.map((entry) => ({ ice: entry.invoice!.supplier.ice, name: entry.invoice!.supplier.name, number: entry.invoice!.number })),
      );
      readable.forEach((entry, index) => {
        const match = response.matches?.[index] ?? null;
        entry.match = match;
        entry.checks = checkUbl(entry.invoice!, { organizationIce: response.organizationIce ?? null, duplicate: match?.duplicate ?? false });
      });
      setEntries(parsed);
    });

  const update = (key: string, change: Partial<Entry>) => setEntries((current) => current.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)));

  const importAll = () =>
    startImport(async () => {
      for (const entry of importable) {
        // Le fichier part directement vers le stockage ; le serveur le relit et le contrôle
        const invoiceId = crypto.randomUUID();
        const path = attachmentPath(organizationId, invoiceId, `${entry.file.name.replace(/\.[^.]*$/, "")}.xml`, crypto.randomUUID());
        const { error: uploadError } = await createClient().storage.from("factures").upload(path, entry.file, { contentType: "application/xml", upsert: false });
        const result = uploadError ? { error: "L'envoi du fichier a échoué. Réessayez." } : await importUbl({ invoiceId, path, createSupplier: entry.createSupplier });
        update(entry.key, { result });
      }
    });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Fichiers UBL</CardTitle>
          <CardDescription>
            Factures électroniques reçues de vos fournisseurs (XML UBL 2.1), {MAX_FILES} fichiers au plus à la fois. Rien n&apos;est
            enregistré avant votre confirmation ; chaque fichier importé est archivé 10 ans.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <label className="text-sm" htmlFor="ubl-files">
            Fichiers
          </label>
          <input
            id="ubl-files"
            type="file"
            multiple
            accept=".xml,application/xml,text/xml"
            className="text-sm file:me-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1"
            disabled={reading || importing}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) {
                onFiles(files);
              }
            }}
          />
          {reading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Lecture des fichiers" />}
        </CardContent>
      </Card>

      {entries.map((entry) => (
        <Card key={entry.key} role="region" aria-label={`Fichier ${entry.file.name}`}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <FileCodeIcon className="size-4" aria-hidden />
              {entry.invoice ? `Facture ${entry.invoice.number}` : entry.file.name}
              {entry.result?.invoiceId && (
                <Badge variant="secondary">
                  <CircleCheckIcon aria-hidden />
                  Importée et archivée
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{entry.file.name}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {entry.invoice && (
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Fournisseur</dt>
                  <dd>
                    {entry.match?.supplier ? (
                      <Link href={`/fournisseurs/${entry.match.supplier.id}`} className="font-medium hover:underline">
                        {entry.match.supplier.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{entry.invoice.supplier.name}</span>
                    )}
                    {entry.invoice.supplier.ice && <div className="font-mono text-xs text-muted-foreground">ICE {entry.invoice.supplier.ice}</div>}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Date · échéance</dt>
                  <dd>
                    {formatDate(entry.invoice.issueDate)}
                    {entry.invoice.dueDate && ` · ${formatDate(entry.invoice.dueDate)}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">HT · TVA</dt>
                  <dd className="tabular-nums">
                    {entry.invoice.amountExclTax !== null ? formatMAD(entry.invoice.amountExclTax) : "—"} ·{" "}
                    {entry.invoice.vatAmount !== null ? formatMAD(entry.invoice.vatAmount) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">TTC</dt>
                  <dd className="font-medium tabular-nums">{formatMAD(entry.invoice.amountInclTax)}</dd>
                </div>
              </dl>
            )}
            {entry.invoice && entry.match && !entry.match.supplier && !entry.result?.invoiceId && (
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={entry.createSupplier}
                  onChange={(event) => update(entry.key, { createSupplier: event.target.checked })}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  Fournisseur inconnu : créer « {entry.invoice.supplier.name} »
                  {[
                    entry.invoice.supplier.ice && `ICE ${entry.invoice.supplier.ice}`,
                    entry.invoice.supplier.taxId && `IF ${entry.invoice.supplier.taxId}`,
                    entry.invoice.supplier.tradeRegister,
                    entry.invoice.supplier.city,
                    entry.invoice.supplier.rib && `RIB ${entry.invoice.supplier.rib}`,
                  ]
                    .filter(Boolean)
                    .map((part) => ` · ${part}`)
                    .join("")}
                </span>
              </label>
            )}
            {entry.checks.map((check) => (
              <p key={check.message} className={`flex items-start gap-2 ${check.level === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                {check.level === "error" ? <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
                {check.message}
              </p>
            ))}
            {entry.result?.error && (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden />
                <AlertDescription>{entry.result.error}</AlertDescription>
              </Alert>
            )}
            {entry.result?.invoiceId && (
              <Link href={`/factures/${entry.result.invoiceId}`} className="w-fit underline">
                Ouvrir la facture
              </Link>
            )}
          </CardContent>
        </Card>
      ))}

      {entries.length > 0 && (
        <Button size="lg" className="w-fit" disabled={importing || importable.length === 0} onClick={importAll}>
          {importing ? <Loader2Icon className="animate-spin" aria-hidden /> : <UploadIcon aria-hidden />}
          Importer {importable.length} facture(s)
        </Button>
      )}
    </div>
  );
}
