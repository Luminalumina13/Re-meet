import { NextResponse } from "next/server";
import { meetupRequestSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { meetup } from "@/lib/meetup/engine";
import { COST, guardSearch } from "@/lib/api/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = meetupRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const blocked = guardSearch(req, parsed.data.friends.reduce((n, f) => n + f.origins.length, 0) * parsed.data.destinations.length * 2 * COST.meetupPerRoute);
  if (blocked) return blocked;
  try {
    const res = await meetup(parsed.data, { signal: req.signal });
    return NextResponse.json(res);
  } catch (e) {
    return serverError(e);
  }
}
