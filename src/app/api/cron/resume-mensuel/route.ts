import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { todayIso } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { previousMonth } from "@/lib/summaries/figures";
import { runMonthlySummaries } from "@/lib/summaries/monthly";
import { createAdminClient } from "@/lib/supabase/admin";

/** Toutes les entreprises en une exécution, paragraphe de l'assistant compris : laisser le temps. */
export const maxDuration = 300;

/** Jeton « Bearer » envoyé par Vercel Cron, comparé en temps constant ; sans CRON_SECRET, tout est refusé. */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Résumé mensuel par e-mail (Vercel Cron le 1er du mois, voir vercel.json) : mois écoulé.
 * Rejouable : une entreprise déjà traitée pour ce mois n'est pas relancée.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const today = todayIso();
  const outcomes = await runMonthlySummaries({
    admin: createAdminClient(),
    today,
    appName: appConfig.name,
    siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
  });
  const summary = Object.fromEntries(
    [...new Set(outcomes.map((o) => o.status))].map((status) => [status, outcomes.filter((o) => o.status === status).length]),
  );
  return NextResponse.json({ month: previousMonth(today).start, organizations: outcomes.length, summary });
}
