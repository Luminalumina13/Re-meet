import { NextResponse } from "next/server";
import { notFound, serverError } from "@/lib/api/respond";
import { checkWatch } from "@/lib/watch/checker";
import { publicWatch } from "@/lib/watch/public";
import { ownedWatch } from "@/lib/watch/owner";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    if (!(await ownedWatch(req, id))) return notFound();
    const r = await checkWatch(id);
    return r ? NextResponse.json({ ...r, watch: publicWatch(r.watch) }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return serverError(e);
  }
}
