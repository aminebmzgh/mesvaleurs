"use client";

import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { formatDate, formatMAD } from "@/lib/format";

export type ChartDay = { date: string; balance: number; outflow: number; count: number };

const [WIDTH, HEIGHT] = [800, 280];
const PAD = { left: 64, right: 96, top: 16, bottom: 28 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

/** Graduations « rondes » couvrant [min, max]. */
function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => span / s <= count) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let value = Math.floor(min / step) * step; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return ticks;
}

/**
 * Courbe du solde prévisionnel (une série) : trait de 2 px, lavis à 10 %, ligne du zéro,
 * premier jour négatif signalé (couleur « critique » + libellé). Réticule et infobulle au
 * survol et au clavier (flèches) ; le tableau des mouvements tient lieu de vue tabulaire.
 */
export function ForecastChart({ days, firstNegative }: { days: ChartDay[]; firstNegative: string | null }) {
  const [active, setActive] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const ticks = niceTicks(Math.min(0, ...days.map((d) => d.balance)), Math.max(0, ...days.map((d) => d.balance)));
  const [yMin, yMax] = [ticks[0], ticks.at(-1)!];
  const x = (i: number) => PAD.left + (days.length > 1 ? (i / (days.length - 1)) * PLOT_W : 0);
  const y = (value: number) => PAD.top + ((yMax - value) / (yMax - yMin || 1)) * PLOT_H;

  const line = days.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.balance).toFixed(1)}`).join(" ");
  const area = `${line} L${x(days.length - 1).toFixed(1)},${y(yMin)} L${x(0)},${y(yMin)} Z`;
  const negativeIndex = firstNegative ? days.findIndex((d) => d.date === firstNegative) : -1;
  const last = days.length - 1;

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const box = svg.current!.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    setActive(Math.min(Math.max(Math.round(((px - PAD.left) / PLOT_W) * last), 0), last));
  };
  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step) {
      event.preventDefault();
      setActive((current) => Math.min(Math.max((current ?? 0) + step, 0), last));
    }
  };

  const hovered = active !== null ? days[active] : null;
  return (
    <div className="relative">
      <svg
        ref={svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="img"
        aria-label={`Solde prévisionnel sur ${last} jours, de ${formatMAD(days[0].balance)} à ${formatMAD(days[last].balance)}`}
        tabIndex={0}
        onPointerMove={pick}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((current) => current ?? 0)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        {/* Grille et axe des montants */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "var(--muted-foreground)" : "var(--border)"} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {compact.format(tick)}
            </text>
          </g>
        ))}
        {/* Axe des dates : tous les 15 jours */}
        {days.map((d, i) =>
          i % 15 === 0 ? (
            <text key={d.date} x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? "start" : "middle"} className="fill-muted-foreground text-[11px]">
              {formatDate(d.date).slice(0, 5)}
            </text>
          ) : null,
        )}

        <g className="text-[#2a78d6] dark:text-[#3987e5]">
          <path d={area} fill="currentColor" opacity={0.1} />
          <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={y(days[last].balance)} r={4} fill="currentColor" stroke="var(--card)" strokeWidth={2} />
        </g>
        {/* Solde final, au bout de la courbe */}
        <text x={x(last) + 8} y={y(days[last].balance)} dy="0.32em" className="fill-foreground text-[12px] font-medium tabular-nums">
          {formatMAD(days[last].balance)}
        </text>

        {negativeIndex >= 0 && (
          <g>
            <circle cx={x(negativeIndex)} cy={y(days[negativeIndex].balance)} r={5} fill="#d03b3b" stroke="var(--card)" strokeWidth={2} />
            <text
              x={x(negativeIndex)}
              y={y(days[negativeIndex].balance) + 18}
              textAnchor={negativeIndex > last * 0.8 ? "end" : "middle"}
              className="fill-foreground text-[11px] font-medium"
            >
              ⚠ Négatif le {formatDate(days[negativeIndex].date).slice(0, 5)}
            </text>
          </g>
        )}

        {hovered && active !== null && (
          <g pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--muted-foreground)" strokeWidth={1} />
            <circle cx={x(active)} cy={y(hovered.balance)} r={4} className="fill-[#2a78d6] dark:fill-[#3987e5]" stroke="var(--card)" strokeWidth={2} />
          </g>
        )}
      </svg>

      {hovered && active !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
          style={active > last / 2 ? { right: `${100 - (x(active) / WIDTH) * 100 + 2}%` } : { left: `${(x(active) / WIDTH) * 100 + 2}%` }}
          role="status"
        >
          <p className="text-sm font-semibold tabular-nums">{formatMAD(hovered.balance)}</p>
          <p className="text-muted-foreground">{formatDate(hovered.date)}</p>
          {hovered.outflow > 0 && (
            <p className="text-muted-foreground">
              {hovered.count} débit{hovered.count > 1 ? "s" : ""} : {formatMAD(hovered.outflow)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
