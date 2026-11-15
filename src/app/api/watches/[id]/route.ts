import { NextResponse } from "next/server";
import { watchPatchSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { watchStore } from "@/lib/watch/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const w = await watchStore().get(id);
  return w ? NextResponse.json(w) : NextResponse.json({ error: "Not found" }, { status: 404 });
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
    const { targetPrice, ...rest } = parsed.data;
    const patch = { ...rest, ...(targetPrice === undefined ? {} : { targetPrice: targetPrice ?? undefined }) };
    const w = await watchStore().update(id, patch);
    return w ? NextResponse.json(w) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await watchStore().delete(id);
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
