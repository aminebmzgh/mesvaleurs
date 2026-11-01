"use client";

import { PlusIcon, ScanTextIcon, Trash2Icon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { emptyReviewLine, type ReviewField, type ReviewLine } from "@/lib/statements/ocr/review";
import { cn } from "@/lib/utils";

const DOUBTFUL_CLASS = "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/60";

/**
 * Vérification d'un relevé lu par OCR : chaque mouvement est corrigeable à côté de
 * l'image du relevé, les lectures incertaines sont surlignées.
 */
export function OcrReview({
  lines,
  errors,
  pages,
  onChange,
}: {
  lines: ReviewLine[];
  errors: Map<string, string>;
  pages: string[];
  onChange: (lines: ReviewLine[]) => void;
}) {
  const doubtful = lines.filter((line) => line.doubtful.length > 0).length;
  const update = (id: string, field: ReviewField, value: string) =>
    onChange(
      lines.map((line) =>
        line.id === id ? { ...line, [field]: value, doubtful: line.doubtful.filter((candidate) => candidate !== field) } : line,
      ),
    );

  const field = (line: ReviewLine, number: number, name: ReviewField, label: string, props: React.ComponentProps<"input"> = {}) => {
    const isDoubtful = line.doubtful.includes(name);
    const { className, ...rest } = props;
    return (
      <Input
        {...rest}
        aria-label={`${label}, ligne ${number}`}
        value={line[name]}
        title={isDoubtful ? "Lecture incertaine : vérifiez avec le relevé" : undefined}
        data-doubtful={isDoubtful || undefined}
        className={cn(isDoubtful && DOUBTFUL_CLASS, className)}
        aria-invalid={errors.has(line.id) || undefined}
        onChange={(event) => update(line.id, name, event.target.value)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <ScanTextIcon aria-hidden />
        <AlertTitle>Relevé lu par reconnaissance de caractères : vérifiez chaque ligne</AlertTitle>
        <AlertDescription>
          Comparez dates, libellés et montants avec l&apos;image du relevé.{" "}
          {doubtful > 0
            ? `${doubtful} ligne(s) comportent une lecture incertaine, surlignée.`
            : "Aucune lecture incertaine signalée, mais une erreur reste possible."}
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="overflow-x-auto">
          <Table aria-label="Mouvements lus sur le relevé scanné">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead className="w-40">Date</TableHead>
                <TableHead className="min-w-56">Libellé</TableHead>
                <TableHead className="w-32 text-end">Débit</TableHead>
                <TableHead className="w-32 text-end">Crédit</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Supprimer</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={line.id} className="align-top">
                  <TableCell className="pt-3 text-muted-foreground tabular-nums">{index + 1}</TableCell>
                  <TableCell>{field(line, index + 1, "operationDate", "Date", { type: "date" })}</TableCell>
                  <TableCell>
                    {field(line, index + 1, "label", "Libellé")}
                    {errors.has(line.id) && <p className="mt-1 text-xs text-destructive">{errors.get(line.id)}</p>}
                  </TableCell>
                  <TableCell>{field(line, index + 1, "debit", "Débit", { inputMode: "decimal", className: "text-end tabular-nums" })}</TableCell>
                  <TableCell>{field(line, index + 1, "credit", "Crédit", { inputMode: "decimal", className: "text-end tabular-nums" })}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Supprimer la ligne ${index + 1}`}
                      onClick={() => onChange(lines.filter((candidate) => candidate.id !== line.id))}
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => onChange([...lines, emptyReviewLine(`n${crypto.randomUUID()}`, lines.at(-1)?.operationDate)])}
          >
            <PlusIcon aria-hidden />
            Ajouter une ligne oubliée
          </Button>
        </div>
        <div className="flex max-h-[80vh] flex-col gap-3 overflow-y-auto rounded-lg border p-2 xl:sticky xl:top-4">
          {pages.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block" title="Ouvrir en grand">
              {/* Image locale (blob:), non optimisable par next/image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Page ${index + 1} du relevé scanné`} className="w-full rounded border bg-white" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
