import { NextResponse } from "next/server";
import { serverError } from "@/lib/api/respond";
import { checkDue } from "@/lib/watch/checker";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron entry point: POST /api/watches/check  (or GET for Vercel Cron).
 * Protect with CRON_SECRET: send `Authorization: Bearer <secret>`.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const min = Number(new URL(req.url).searchParams.get("minIntervalMin") ?? process.env.WATCH_MIN_INTERVAL_MIN ?? 30);
  try {
    return NextResponse.json(await checkDue(min));
  } catch (e) {
    return serverError(e);
  }
}

export const GET = handle;
export const POST = handle;
