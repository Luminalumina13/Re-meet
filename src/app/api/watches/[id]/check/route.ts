import { NextResponse } from "next/server";
import { serverError } from "@/lib/api/respond";
import { checkWatch } from "@/lib/watch/checker";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const r = await checkWatch(id);
    return r ? NextResponse.json(r) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return serverError(e);
  }
}
