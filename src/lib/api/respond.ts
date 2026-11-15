import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function badRequest(err: ZodError | string) {
  const issues = typeof err === "string" ? [{ path: [], message: err }] : err.issues.map((i) => ({ path: i.path, message: i.message }));
  return NextResponse.json({ error: "Invalid request", issues }, { status: 400 });
}

export function serverError(e: unknown) {
  console.error(e);
  return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
}
