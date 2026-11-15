import { NextResponse } from "next/server";
import { watchCreateSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { watchStore } from "@/lib/watch/store";
import { checkWatch } from "@/lib/watch/checker";
import { publicWatch } from "@/lib/watch/public";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json((await watchStore().list()).map(publicWatch));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = watchCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  try {
    const created = await watchStore().create({ ...parsed.data, currency: parsed.data.params.request.currency });
    // Baseline check so the first alert compares against a real price.
    const checked = await checkWatch(created.id);
    return NextResponse.json(publicWatch(checked?.watch ?? created), { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
