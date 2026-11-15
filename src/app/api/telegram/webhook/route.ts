import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { botToken } from "@/lib/telegram/api";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/bot";
import { liveDeps } from "@/lib/telegram/polling";

export const runtime = "nodejs";
export const maxDuration = 120;

function secretOk(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Telegram webhook. The chat id is the user's identity, so forged updates would let anyone act as
 * any chat: the secret header is mandatory and the endpoint stays closed until it is configured.
 */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!botToken() || !secret) return NextResponse.json({ error: "Telegram bot is not configured" }, { status: 503 });
  if (!secretOk(req.headers.get("x-telegram-bot-api-secret-token"), secret)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  // Answer at once so Telegram does not retry; "check now" can take half a minute.
  after(() => handleUpdate(update, liveDeps()));
  return NextResponse.json({ ok: true });
}
