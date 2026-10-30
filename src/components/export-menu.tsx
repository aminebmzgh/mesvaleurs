import { DownloadIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const FORMATS = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel" },
  { value: "pdf", label: "PDF" },
] as const;

/** Liens d'export d'une liste (CSV, Excel, PDF), avec les filtres affichés. */
export function ExportLinks({
  list,
  path = `/exports/${list}`,
  params,
}: {
  list?: "paiements" | "factures" | "fournisseurs";
  /** Route d'export, si ce n'est pas celle d'une liste. */
  path?: string;
  params: Record<string, string | undefined>;
}) {
  const filters = Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => !!entry[1]));
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <DownloadIcon className="size-4" aria-hidden />
      <span>Exporter :</span>
      {FORMATS.map((format) => (
        <a
          key={format.value}
          href={`${path}?${new URLSearchParams({ ...filters, format: format.value })}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          download
        >
          {format.label}
        </a>
      ))}
    </div>
  );
}
