import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, badRequest } from "@/lib/api/respond";
import { HUMAN_COOKIE, HUMAN_TTL_S, clientAddress, signHuman, spend } from "@/lib/api/guard";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(1).max(2048) });

/** Exchanges a Turnstile token for a cookie that lets this browser search for an hour. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  const client = clientAddress(req);
  // Failed or repeated checks also cost a little, so this cannot be hammered.
  if (!spend(client, 5).ok) return apiError("search_limit", 429);
  if (!(await verifyTurnstile(parsed.data.token, client))) return apiError("bot_check_failed", 403);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HUMAN_COOKIE, signHuman(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: HUMAN_TTL_S });
  return res;
}
