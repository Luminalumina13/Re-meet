import { NextResponse } from "next/server";
import { notFound, serverError } from "@/lib/api/respond";
import { botToken, botUsername } from "@/lib/telegram/api";
import { createTelegramLink } from "@/lib/telegram/bot";
import { watchStore } from "@/lib/watch/store";
import { ownedWatch } from "@/lib/watch/owner";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Creates a one-time t.me link that connects this watch to the user's Telegram chat. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await ownedWatch(req, id))) return notFound();
  if (!botToken()) return NextResponse.json({ error: "Telegram bot is not configured on the server" }, { status: 501 });
  try {
    const username = await botUsername();
    if (!username) return NextResponse.json({ error: "Could not reach Telegram" }, { status: 502 });
    const link = await createTelegramLink(watchStore(), id);
    if (!link) return notFound();
    return NextResponse.json({ url: `https://t.me/${username}?start=${link.token}`, expiresAt: link.expiresAt });
  } catch (e) {
    return serverError(e);
  }
}

/** Disconnects Telegram from this watch. */
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const store = watchStore();
  const w = await ownedWatch(req, id);
  if (!w) return notFound();
  await store.update(id, { notify: { ...w.notify, telegramChatId: undefined, telegramVerified: undefined, telegramLang: undefined }, telegramLink: undefined });
  return new NextResponse(null, { status: 204 });
}
