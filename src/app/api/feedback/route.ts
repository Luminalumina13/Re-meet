import { NextResponse } from "next/server";
import { apiError, badRequest, serverError } from "@/lib/api/respond";
import { allowFeedback, feedbackConfig, feedbackSchema, sendFeedback } from "@/lib/feedback";

export const runtime = "nodejs";

/** Question form on /faq: POST { message, contact?, lang?, website (honeypot) }. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Body must be JSON");
  }
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error);
  // A bot filled the hidden field: answer as if it worked, deliver nothing.
  if (parsed.data.website) return NextResponse.json({ ok: true }, { status: 201 });

  const cfg = feedbackConfig();
  if (!cfg) return apiError("unavailable", 503);
  // Caddy puts the real address in X-Forwarded-For.
  const client = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowFeedback(client)) return apiError("rate_limited", 429);
  try {
    return (await sendFeedback(parsed.data, cfg)) ? NextResponse.json({ ok: true }, { status: 201 }) : apiError("unavailable", 502);
  } catch (e) {
    return serverError(e);
  }
}
