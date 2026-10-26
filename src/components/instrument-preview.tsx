import { amountInWords } from "@/lib/amount-in-words";
import { formatInstrumentNumber } from "@/lib/checkbooks";
import { formatAmount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type InstrumentPreviewProps = {
  type: "check" | "lcn";
  bankName: string;
  number: number | null;
  numberWidth: number;
  amount: number;
  payee: string;
  place: string;
  issueDate: string;
  dueDate?: string | null;
  rectified?: boolean;
  className?: string;
};

/**
 * Rendu indicatif d'une formule (chèque ou LCN), pour vérifier les mentions avant
 * impression. Le placement exact sur la formule bancaire dépend du modèle d'impression.
 */
export function InstrumentPreview({
  type,
  bankName,
  number,
  numberWidth,
  amount,
  payee,
  place,
  issueDate,
  dueDate,
  rectified,
  className,
}: InstrumentPreviewProps) {
  const valid = amount > 0;
  const words = valid ? amountInWords(amount, { rectified }) : "—";
  const label = type === "check" ? "Chèque" : "Lettre de change normalisée";

  return (
    <figure
      className={cn(
        "relative flex aspect-[175/80] w-full flex-col justify-between overflow-hidden rounded-lg border bg-gradient-to-br from-card to-muted/60 p-4 font-mono text-xs shadow-sm",
        className,
      )}
      aria-label={`Aperçu ${label.toLowerCase()} ${number != null ? formatInstrumentNumber(number, numberWidth) : ""}`}
    >
      <div className="flex items-start justify-between gap-2 font-sans">
        <div>
          <p className="text-sm font-semibold">{bankName}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
        <p className="rounded border-2 border-foreground/70 px-2 py-0.5 text-sm font-semibold tabular-nums">
          #{valid ? formatAmount(amount) : "0,00"}#
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="leading-snug">
          <span className="font-sans text-[10px] text-muted-foreground">
            {type === "check" ? "Payez contre ce chèque " : "Veuillez payer la somme de "}
          </span>
          {words}
        </p>
        <p>
          <span className="font-sans text-[10px] text-muted-foreground">À l&apos;ordre de </span>
          {payee || "—"}
        </p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p>
          <span className="font-sans text-[10px] text-muted-foreground">À </span>
          {place || "—"}
          <span className="font-sans text-[10px] text-muted-foreground">, le </span>
          {formatDate(issueDate)}
          {type === "lcn" && (
            <>
              <span className="font-sans text-[10px] text-muted-foreground"> · Échéance </span>
              <span className="font-semibold">{dueDate ? formatDate(dueDate) : "—"}</span>
            </>
          )}
        </p>
        <p className="tabular-nums text-muted-foreground">
          N° {number != null ? formatInstrumentNumber(number, numberWidth) : "—"}
        </p>
      </div>
    </figure>
  );
}
