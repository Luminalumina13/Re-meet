import { NextResponse } from "next/server";
import { watchPatchSchema } from "@/lib/api/schemas";
import { badRequest, notFound, serverError } from "@/lib/api/respond";
import { watchStore } from "@/lib/watch/store";
import { publicWatch } from "@/lib/watch/public";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const w = await watchStore().get(id);
  return w ? NextResponse.json(publicWatch(w)) : notFound();
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
    if (!cur) return notFound();
    const { targetPrice, notify, ...rest } = parsed.data;
    const patch: Partial<typeof cur> = { ...rest, ...(targetPrice === undefined ? {} : { targetPrice: targetPrice ?? undefined }) };
    if (notify) {
      const { webhookUrl, ...restNotify } = notify;
      // A chat id typed by hand is not proof of ownership: it can notify, but never unlocks the bot.
      const chatChanged = restNotify.telegramChatId !== undefined && restNotify.telegramChatId !== cur.notify.telegramChatId;
      patch.notify = { ...cur.notify, ...restNotify, ...(webhookUrl === undefined ? {} : { webhookUrl: webhookUrl ?? undefined }), ...(chatChanged ? { telegramVerified: undefined, telegramLang: undefined } : {}) };
    }
    const w = await store.update(id, patch);
    return w ? NextResponse.json(publicWatch(w)) : notFound();
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await watchStore().delete(id);
  return ok ? new NextResponse(null, { status: 204 }) : notFound();
}
