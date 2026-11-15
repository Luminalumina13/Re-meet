import { NextResponse } from "next/server";
import { watchPatchSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { watchStore } from "@/lib/watch/store";
import { publicWatch } from "@/lib/watch/public";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const w = await watchStore().get(id);
  return w ? NextResponse.json(publicWatch(w)) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = watchPatchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const store = watchStore();
    const cur = await store.get(id);
    if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { targetPrice, notify, ...rest } = parsed.data;
    const patch: Partial<typeof cur> = { ...rest, ...(targetPrice === undefined ? {} : { targetPrice: targetPrice ?? undefined }) };
    if (notify) {
      // A chat id typed by hand is not proof of ownership: it can notify, but never unlocks the bot.
      const chatChanged = notify.telegramChatId !== undefined && notify.telegramChatId !== cur.notify.telegramChatId;
      patch.notify = { ...cur.notify, ...notify, ...(chatChanged ? { telegramVerified: undefined, telegramLang: undefined } : {}) };
    }
    const w = await store.update(id, patch);
    return w ? NextResponse.json(publicWatch(w)) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await watchStore().delete(id);
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
