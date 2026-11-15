import { NextResponse } from "next/server";
import { searchRequestSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { search } from "@/lib/providers/aggregator";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = searchRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const res = await search(parsed.data, { signal: req.signal });
    return NextResponse.json(res);
  } catch (e) {
    return serverError(e);
  }
}
