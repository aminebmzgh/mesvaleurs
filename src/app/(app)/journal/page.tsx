import { DownloadIcon, ScrollTextIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FormSelect } from "@/components/form-select";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ACTION_FILTERS,
  actionLabel,
  changedFields,
  describeRecord,
  fieldLabel,
  formatValue,
  recordHref,
  TABLE_LABELS,
  tableLabel,
} from "@/lib/audit/entries";
import { type AuditEntry, type AuditFilters, listAuditActors, listAuditEntries, parseAuditFilters } from "@/lib/audit/queries";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Journal d'audit" };

type Row = Record<string, unknown>;

const TABLE_FILTERS = [
  { value: "tous", label: "Tous les objets" },
  ...Object.entries(TABLE_LABELS)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr")),
];

const ACTION_OPTIONS = [{ value: "toutes", label: "Toutes les actions" }, ...ACTION_FILTERS.map((value) => ({ value, label: actionLabel(value) }))];

export default function AuditLogPage({ searchParams }: PageProps<"/journal">) {
  return (
    <>
      <PageHeader
        title="Journal d'audit"
        description="Qui a fait quoi et quand : créations, modifications, suppressions, émissions, impressions et rapprochements manuels."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <AuditLog searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Paramètres d'URL des filtres, pour la pagination et l'export. */
function filterQuery(filters: AuditFilters, extra: Record<string, string> = {}) {
  const query = new URLSearchParams();
  if (filters.from) query.set("du", filters.from);
  if (filters.to) query.set("au", filters.to);
  if (filters.actorId) query.set("auteur", filters.actorId);
  if (filters.table) query.set("objet", filters.table);
  if (filters.action) query.set("action", filters.action);
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  return query.toString();
}

async function AuditLog({ searchParams }: Pick<PageProps<"/journal">, "searchParams">) {
  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const pageText = typeof params.page === "string" ? params.page : "1";
  const page = /^\d{1,4}$/.test(pageText) && Number(pageText) > 0 ? Number(pageText) : 1;
  const [actors, { entries, hasNext }] = await Promise.all([listAuditActors(), listAuditEntries(filters, page)]);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Form action="/journal" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[9.5rem_9.5rem_1fr_1fr_1fr_auto]" role="search">
          <Input type="date" name="du" defaultValue={filters.from} aria-label="Du" />
          <Input type="date" name="au" defaultValue={filters.to} aria-label="Au" />
          <FormSelect name="auteur" options={[{ value: "tous", label: "Tous les auteurs" }, ...actors]} defaultValue={filters.actorId ?? "tous"} />
          <FormSelect name="objet" options={TABLE_FILTERS} defaultValue={filters.table ?? "tous"} />
          <FormSelect name="action" options={ACTION_OPTIONS} defaultValue={filters.action ?? "toutes"} />
          <Button type="submit" variant="outline">
            <SearchIcon aria-hidden />
            Filtrer
          </Button>
        </Form>

        {entries.length === 0 ? (
          <EmptyState
            icon={ScrollTextIcon}
            title="Aucune entrée"
            description={filtered ? "Aucune action ne correspond à ces critères." : "Aucune action n'a encore été enregistrée."}
          />
        ) : (
          <>
            <div className="flex justify-end">
              <a href={`/journal/export?${filterQuery(filters)}`} className={buttonVariants({ variant: "outline", size: "sm" })} download>
                <DownloadIcon aria-hidden />
                Exporter en CSV
              </a>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Auteur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Objet</TableHead>
                    <TableHead>Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {(page > 1 || hasNext) && (
          <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
            {page > 1 ? (
              <Link href={`/journal?${filterQuery(filters, { page: String(page - 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Plus récentes
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">Page {page}</span>
            {hasNext ? (
              <Link href={`/journal?${filterQuery(filters, { page: String(page + 1) })}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Plus anciennes
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </CardContent>
    </Card>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const before = entry.before as Row | null;
  const after = entry.after as Row | null;
  const details = entry.details as Row | null;
  const changes = changedFields(before, after);
  const href = recordHref(entry.table_name, entry.record_id, before, after);
  const subject = describeRecord(entry.table_name, before, after, details);
  const destructive = entry.action === "delete" || (entry.table_name === "payments" && after?.status === "cancelled" && before?.status !== "cancelled");

  return (
    <TableRow className="align-top">
      <TableCell className="whitespace-nowrap tabular-nums">{entry.created_at ? formatDateTime(entry.created_at) : "—"}</TableCell>
      <TableCell>{entry.actor_name || entry.actor_email || <span className="text-muted-foreground">Système</span>}</TableCell>
      <TableCell>
        <Badge variant={destructive ? "destructive" : entry.action === "update" ? "secondary" : "outline"}>{actionLabel(entry.action ?? "")}</Badge>
      </TableCell>
      <TableCell>
        <span className="block text-xs text-muted-foreground">{tableLabel(entry.table_name)}</span>
        {href ? (
          <Link href={href} className="hover:underline">
            {subject}
          </Link>
        ) : (
          subject
        )}
      </TableCell>
      <TableCell className="min-w-64">
        {changes.length > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm">
              {entry.action === "update"
                ? changes.map((c) => fieldLabel(c.field)).join(", ")
                : `${changes.length} champ${changes.length > 1 ? "s" : ""}`}
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {changes.map((change) => (
                <ChangeLine key={change.field} table={entry.table_name} action={entry.action} {...change} />
              ))}
            </dl>
          </details>
        ) : details && Object.keys(details).length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {typeof details.print_number === "number" ? `Impression n° ${details.print_number}` : null}
          </span>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function ChangeLine({ table, action, field, before, after }: { table: string | null; action: string | null; field: string; before: unknown; after: unknown }) {
  return (
    <>
      <dt className="text-muted-foreground">{fieldLabel(field)}</dt>
      <dd className="break-all">
        {action === "update" ? (
          <>
            <span className="line-through opacity-60">{formatValue(table, field, before)}</span> → {formatValue(table, field, after)}
          </>
        ) : (
          formatValue(table, field, action === "delete" ? before : after)
        )}
      </dd>
    </>
  );
}
