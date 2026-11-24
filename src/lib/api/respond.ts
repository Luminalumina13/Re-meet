import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { reportError } from "@/lib/errorReport";

/** Stable machine-readable codes: the front end maps them to localized text, never shows `error` verbatim. */
export type ErrorCode = "invalid_request" | "bad_json" | "not_found" | "unauthorized" | "unavailable" | "rate_limited" | "bot_check_failed" | "human_check" | "search_limit" | "internal";

export function apiError(code: ErrorCode, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: code, code, ...extra }, { status });
}

export function badRequest(err: ZodError | string) {
  if (err === "Body must be JSON") return apiError("bad_json", 400);
  const issues = typeof err === "string" ? [{ path: [], message: err }] : err.issues.map((i) => ({ path: i.path, message: i.message }));
  return apiError("invalid_request", 400, { issues });
}

export const notFound = () => apiError("not_found", 404);

export function serverError(e: unknown) {
  console.error(e);
  void reportError("API 500", e);
  return apiError("internal", 500);
}
