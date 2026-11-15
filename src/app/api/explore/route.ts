import { NextResponse } from "next/server";
import { exploreRequestSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { explore } from "@/lib/explore/engine";

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
  try {
    return NextResponse.json(await explore(parsed.data, { signal: req.signal }));
  } catch (e) {
    return serverError(e);
  }
}
