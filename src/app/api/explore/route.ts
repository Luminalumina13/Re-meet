import { NextResponse } from "next/server";
import { exploreRequestSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { explore } from "@/lib/explore/engine";
import { COST, guardSearch } from "@/lib/api/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = exploreRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const blocked = guardSearch(req, COST.explore * (1 + (parsed.data.origins?.filter((o) => o !== parsed.data.origin).length ?? 0)));
  if (blocked) return blocked;
  try {
    return NextResponse.json(await explore(parsed.data, { signal: req.signal }));
  } catch (e) {
    return serverError(e);
  }
}
