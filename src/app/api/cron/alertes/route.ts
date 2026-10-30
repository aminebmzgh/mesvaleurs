import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { runDailyDigests } from "@/lib/alerts/digests";
import { appConfig } from "@/lib/config";
import { todayIso } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Toutes les entreprises en une exécution : laisser le temps aux envois. */
export const maxDuration = 60;

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
 * Récapitulatif quotidien des alertes par e-mail (Vercel Cron, voir vercel.json).
 * Rejouable : une entreprise déjà traitée ce jour n'est pas relancée.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const today = todayIso();
  const outcomes = await runDailyDigests({
    admin: createAdminClient(),
    today,
    appName: appConfig.name,
    siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
  });
  const summary = Object.fromEntries(
    [...new Set(outcomes.map((o) => o.status))].map((status) => [status, outcomes.filter((o) => o.status === status).length]),
  );
  return NextResponse.json({ date: today, organizations: outcomes.length, summary });
}
