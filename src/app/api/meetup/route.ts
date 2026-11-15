import { NextResponse } from "next/server";
import { meetupRequestSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { meetup } from "@/lib/meetup/engine";

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
  try {
    const res = await meetup(parsed.data, { signal: req.signal });
    return NextResponse.json(res);
  } catch (e) {
    return serverError(e);
  }
}
