import { ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, ClockIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { addDays, todayIso } from "@/lib/dates";
import {
  type CalendarEvent,
  DUE_STATUS_LABELS,
  type DueStatus,
  EVENT_KIND_LABELS,
  monthGrid,
  monthLabel,
  shiftMonth,
  startOfWeek,
  weekDays,
} from "@/lib/forecast/calendar";
import { getCalendarEvents } from "@/lib/forecast/queries";
import { formatDate, formatMAD } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendrier des échéances" };

const WEEKDAYS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];

/** Code couleur des états (couleurs d'état réservées, toujours avec icône et libellé). */
const STATUS_STYLES: Record<DueStatus, { icon: LucideIcon; className: string }> = {
  paid: { icon: CircleCheckIcon, className: "border-[#0ca30c]/40 bg-[#0ca30c]/10 [&_svg]:text-[#0ca30c]" },
  pending: { icon: ClockIcon, className: "border-border bg-muted/60 [&_svg]:text-muted-foreground" },
  late: { icon: CircleAlertIcon, className: "border-[#d03b3b]/50 bg-[#d03b3b]/10 [&_svg]:text-[#d03b3b]" },
};

export default function CalendarPage({ searchParams }: PageProps<"/calendrier">) {
  return (
    <>
      <PageHeader
        title="Calendrier des échéances"
        description="Échéances des LCN, dates limites de paiement des factures (loi 69-21) et restitutions des chèques de garantie."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <CalendarView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function EventChip({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  const { icon: Icon, className } = STATUS_STYLES[event.status];
  return (
    <Link
      href={event.href}
      title={`${EVENT_KIND_LABELS[event.kind]} · ${event.label} · ${event.supplier} · ${formatMAD(event.amount)} · ${DUE_STATUS_LABELS[event.status]}`}
      className={cn("flex items-start gap-1.5 rounded-md border px-1.5 py-1 text-xs hover:underline", className)}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate font-medium">{event.label}</span>
        {!compact && <span className="block truncate text-muted-foreground">{event.supplier}</span>}
        <span className="block tabular-nums">{formatMAD(event.amount)}</span>
        <span className="sr-only">{DUE_STATUS_LABELS[event.status]}</span>
      </span>
    </Link>
  );
}

async function CalendarView({ searchParams }: Pick<PageProps<"/calendrier">, "searchParams">) {
  // Organisation (cookies) avant la date du jour : rendu à la requête
  const [params] = await Promise.all([searchParams, requireActiveOrganization()]);
  const today = todayIso();
  const view = params.vue === "semaine" ? "week" : "month";
  const month = typeof params.mois === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mois) ? params.mois : today.slice(0, 7);
  const weekStart = startOfWeek(typeof params.semaine === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.semaine) ? params.semaine : today);

  const weeks = view === "month" ? monthGrid(month) : [weekDays(weekStart)];
  const [from, to] = [weeks[0][0], weeks.at(-1)![6]];
  const events = await getCalendarEvents(from, to);
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  }

  const title = view === "month" ? monthLabel(month) : `Semaine du ${formatDate(weekStart)}`;
  const previous = view === "month" ? `?vue=mois&mois=${shiftMonth(month, -1)}` : `?vue=semaine&semaine=${addDays(weekStart, -7)}`;
  const next = view === "month" ? `?vue=mois&mois=${shiftMonth(month, 1)}` : `?vue=semaine&semaine=${addDays(weekStart, 7)}`;
  const totals = (["late", "pending", "paid"] as DueStatus[]).map((status) => ({
    status,
    count: events.filter((e) => e.status === status).length,
    amount: events.filter((e) => e.status === status).reduce((sum, e) => sum + e.amount, 0),
  }));
  const daysWithEvents = weeks.flat().filter((date) => byDate.has(date) && (view === "week" || date.slice(0, 7) === month));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Link href={`/calendrier${previous}`} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Période précédente">
              <ChevronLeftIcon aria-hidden />
            </Link>
            <Link href={`/calendrier${next}`} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Période suivante">
              <ChevronRightIcon aria-hidden />
            </Link>
            <h2 className="ms-2 text-lg font-semibold first-letter:uppercase">{title}</h2>
          </div>
          <div className="flex gap-1" role="group" aria-label="Vue">
            <Link
              href={`/calendrier?vue=mois&mois=${view === "week" ? weekStart.slice(0, 7) : month}`}
              aria-current={view === "month" ? "page" : undefined}
              className={buttonVariants({ variant: view === "month" ? "default" : "outline", size: "sm" })}
            >
              Mois
            </Link>
            <Link
              href={`/calendrier?vue=semaine&semaine=${view === "month" ? (month === today.slice(0, 7) ? today : `${month}-01`) : weekStart}`}
              aria-current={view === "week" ? "page" : undefined}
              className={buttonVariants({ variant: view === "week" ? "default" : "outline", size: "sm" })}
            >
              Semaine
            </Link>
          </div>
        </div>

        {/* Légende et totaux de la période */}
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Légende">
          {totals.map(({ status, count, amount }) => {
            const { icon: Icon, className } = STATUS_STYLES[status];
            return (
              <li key={status} className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1", className)}>
                <Icon className="size-3.5" aria-hidden />
                {DUE_STATUS_LABELS[status]} : {count} · {formatMAD(amount)}
              </li>
            );
          })}
        </ul>

        {/* Grille (écrans larges) */}
        <div className="hidden md:block">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
            {WEEKDAYS.map((day) => (
              <div key={day} className="bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {weeks.flat().map((date) => {
              const outside = view === "month" && date.slice(0, 7) !== month;
              return (
                <div key={date} className={cn("flex flex-col gap-1 bg-card p-1.5", view === "month" ? "min-h-28" : "min-h-64", outside && "bg-muted/40")}>
                  <span
                    className={cn(
                      "self-end text-xs tabular-nums",
                      outside ? "text-muted-foreground/60" : "text-muted-foreground",
                      date === today && "rounded-full bg-primary px-1.5 font-semibold text-primary-foreground",
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {!outside && (byDate.get(date) ?? []).map((event, i) => <EventChip key={i} event={event} compact={view === "month"} />)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Liste par jour (téléphones) */}
        <div className="flex flex-col gap-3 md:hidden">
          {daysWithEvents.length === 0 && <p className="text-sm text-muted-foreground">Aucune échéance sur la période.</p>}
          {daysWithEvents.map((date) => (
            <div key={date} className="flex flex-col gap-1">
              <p className="text-sm font-medium">{formatDate(date)}</p>
              {(byDate.get(date) ?? []).map((event, i) => (
                <EventChip key={i} event={event} />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
