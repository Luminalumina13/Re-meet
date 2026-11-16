import { NextResponse } from "next/server";
import { apiError, serverError } from "@/lib/api/respond";
import { checkDue } from "@/lib/watch/checker";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron entry point: POST /api/watches/check  (or GET for Vercel Cron).
 * Protect with CRON_SECRET: send `Authorization: Bearer <secret>`.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Without a secret anyone could trigger a full re-check of every watch: refuse in production.
  if (!secret && process.env.NODE_ENV === "production") {
    return apiError("unavailable", 503);
  }
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return apiError("unauthorized", 401);
  }
  const raw = Number(new URL(req.url).searchParams.get("minIntervalMin") ?? process.env.WATCH_MIN_INTERVAL_MIN ?? 30);
  const min = Number.isFinite(raw) ? Math.max(1, raw) : 30;
  try {
    return NextResponse.json(await checkDue(min));
  } catch (e) {
    return serverError(e);
  }
}

export const GET = handle;
export const POST = handle;
