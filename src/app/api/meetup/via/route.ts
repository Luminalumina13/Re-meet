import { NextResponse } from "next/server";
import { meetupRequestSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { meetVia } from "@/lib/meetup/via";
import { COST, guardSearch, searchedDays } from "@/lib/api/guard";

export const runtime = "nodejs";

/** "Meet on the way": the friends meet at a hub and fly on together. Same request as /api/meetup. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = meetupRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const blocked = guardSearch(req, COST.via * parsed.data.destinations.length * Math.ceil(searchedDays(parsed.data) / 4));
  if (blocked) return blocked;
  try {
    return NextResponse.json(await meetVia(parsed.data, { signal: req.signal }));
  } catch (e) {
    return serverError(e);
  }
}
