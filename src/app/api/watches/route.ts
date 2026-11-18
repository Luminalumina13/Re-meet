import { NextResponse } from "next/server";
import { watchCreateSchema } from "@/lib/api/schemas";
import { badRequest, serverError } from "@/lib/api/respond";
import { watchStore } from "@/lib/watch/store";
import { checkWatch } from "@/lib/watch/checker";
import { publicWatch } from "@/lib/watch/public";
import { hashOwner, newOwnerToken, ownerToken, ownsWatch, setOwnerCookie } from "@/lib/watch/owner";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const token = ownerToken(req);
    if (!token) return NextResponse.json([]);
    return NextResponse.json((await watchStore().list()).filter((w) => ownsWatch(w, token)).map(publicWatch));
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
    const existing = ownerToken(req);
    const token = existing ?? newOwnerToken();
    const created = await watchStore().create({ ...parsed.data, currency: parsed.data.params.request.currency, ownerHash: hashOwner(token) });
    // Baseline check so the first alert compares against a real price.
    const checked = await checkWatch(created.id);
    const res = NextResponse.json(publicWatch(checked?.watch ?? created), { status: 201 });
    return existing ? res : setOwnerCookie(res, token);
  } catch (e) {
    return serverError(e);
  }
}
