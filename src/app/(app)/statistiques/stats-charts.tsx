"use client";

import { useState } from "react";
import { formatMAD } from "@/lib/format";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const SERIES = "bg-[#2a78d6] dark:bg-[#3987e5]";

const monthName = (month: string) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(2, 4)}`;

/**
 * Dépenses par mois : colonnes d'une seule série (≤ 24 px, bout arrondi), valeur du mois le
 * plus élevé sur sa colonne, infobulle au survol et au clavier pour les autres.
 */
export function MonthlyColumns({ months }: { months: { month: string; total: number; count: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...months.map((m) => m.total), 0);
  const peak = months.findIndex((m) => m.total === max && max > 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex h-56 items-end gap-1 border-b" role="list" aria-label="Dépenses par mois">
        {months.map((m, i) => (
          <div
            key={m.month}
            role="listitem"
            tabIndex={0}
            aria-label={`${monthName(m.month)} : ${formatMAD(m.total)}, ${m.count} paiement(s)`}
            className="group relative flex h-full flex-1 items-end justify-center outline-none"
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            {i === peak && (
              <span className="absolute -translate-y-1 text-[11px] font-medium tabular-nums" style={{ bottom: `${(m.total / max) * 100}%` }}>
                {compact.format(m.total)}
              </span>
            )}
            <div
              className={cn("w-full max-w-6 rounded-t-[4px] transition-opacity", SERIES, active !== null && active !== i && "opacity-60", "group-focus-visible:ring-2 group-focus-visible:ring-ring")}
              style={{ height: max > 0 ? `${Math.max((m.total / max) * 100, m.total > 0 ? 1 : 0)}%` : 0 }}
            />
            {active === i && (
              <div
                className={cn(
                  "pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-lg border bg-popover px-3 py-2 text-xs shadow-md",
                  i > months.length / 2 ? "right-0" : "left-0",
                )}
                role="status"
              >
                <p className="text-sm font-semibold tabular-nums">{formatMAD(m.total)}</p>
                <p className="text-muted-foreground">
                  {monthName(m.month)} · {m.count} paiement{m.count > 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-[11px] text-muted-foreground">
        {months.map((m, i) => (
          <span key={m.month} className="flex-1 text-center">
            {months.length <= 12 || i % 2 === 0 ? monthName(m.month) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Dépenses par fournisseur : barres horizontales, valeur au bout de chaque barre. */
export function SupplierBars({ suppliers }: { suppliers: { name: string; total: number; other: boolean }[] }) {
  const max = Math.max(...suppliers.map((s) => s.total), 0);
  return (
    <ul className="flex flex-col gap-2" aria-label="Dépenses par fournisseur">
      {suppliers.map((s) => (
        <li key={s.name} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_8rem]">
          <span className={cn("truncate", s.other && "text-muted-foreground")} title={s.name}>
            {s.name}
          </span>
          {/* Barre proportionnelle sur toute la piste ; la valeur a sa propre colonne */}
          <span className="min-w-0">
            <span
              className={cn("block h-4 rounded-e-[4px]", s.other ? "bg-muted-foreground/40" : SERIES)}
              style={{ width: max > 0 ? `${(s.total / max) * 100}%` : 0, minWidth: s.total > 0 ? 2 : 0 }}
            />
          </span>
          <span className="text-end tabular-nums">{formatMAD(s.total)}</span>
        </li>
      ))}
    </ul>
  );
}
