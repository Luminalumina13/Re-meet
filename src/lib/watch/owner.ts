import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { watchStore } from "./store";
import type { Watch } from "./types";

/**
 * Trackers have no accounts: whoever created one holds a secret token that proves ownership.
 * The browser keeps it in an httpOnly cookie, the mobile app sends it as `Authorization: Bearer <token>`.
 * Only its SHA-256 is stored, so a leaked watches.json does not hand out access.
 */
export const OWNER_COOKIE = "remeeet_owner";
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

export function newOwnerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOwner(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The caller's token, or null when absent or malformed. */
export function ownerToken(req: Request): string | null {
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${OWNER_COOKIE}=`))
    ?.slice(OWNER_COOKIE.length + 1);
  const token = bearer ?? cookie;
  return token && TOKEN_RE.test(token) ? token : null;
}

export function ownsWatch(w: Watch, token: string | null): boolean {
  if (!token || !w.ownerHash) return false;
  const a = Buffer.from(w.ownerHash, "hex");
  const b = Buffer.from(hashOwner(token), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The watch if it exists and belongs to the caller; otherwise undefined (callers answer 404, so ids cannot be probed). */
export async function ownedWatch(req: Request, id: string): Promise<Watch | undefined> {
  const w = await watchStore().get(id);
  return w && ownsWatch(w, ownerToken(req)) ? w : undefined;
}

export function setOwnerCookie<T extends NextResponse>(res: T, token: string): T {
  res.cookies.set(OWNER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return res;
}
