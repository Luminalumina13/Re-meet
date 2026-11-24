import { NextResponse } from "next/server";
import { rangeSearchSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { rangeSearch } from "@/lib/flex/range";
import { COST, guardSearch } from "@/lib/api/guard";

export const runtime = "nodejs";

/** Cheapest trip per day pair over a date range, in a few upstream calls. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = rangeSearchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const blocked = guardSearch(req, COST.range);
  if (blocked) return blocked;
  try {
    return NextResponse.json(await rangeSearch(parsed.data, { signal: req.signal }));
  } catch (e) {
    return serverError(e);
  }
}
