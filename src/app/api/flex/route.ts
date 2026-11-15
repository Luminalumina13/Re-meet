import { NextResponse } from "next/server";
import { flexDaySchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { flexDay } from "@/lib/flex/day";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Cheapest one-way fare on a single day; the flexible-dates grid calls this once per day. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = flexDaySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  if (parsed.data.origin === parsed.data.destination) return badRequest("Origin and destination must differ");
  try {
    return NextResponse.json(await flexDay(parsed.data, { signal: req.signal }));
  } catch (e) {
    return serverError(e);
  }
}
