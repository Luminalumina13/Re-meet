import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { apiError } from "./respond";
import { turnstileEnabled } from "@/lib/turnstile";

/**
 * Protection of the search endpoints from scripts and scrapers:
 *  1. a per-address budget of "search points" (heavier searches cost more), and
 *  2. a signed cookie that this browser passed a Cloudflare Turnstile check (only when Turnstile is configured).
 * The price tracker and the Telegram bot call the search code directly and are not affected.
 */

export const HUMAN_COOKIE = "remeeet_human";
/** How long one passed check lasts. */
export const HUMAN_TTL_S = 60 * 60;

/** Points one address may spend: per 10 minutes and per day. Normal use stays far below; a full "cheapest weekends" sweep is ~100. */
export const WINDOW_MS = 10 * 60_000;
export const WINDOW_POINTS = 600;
export const DAY_POINTS = 4000;

/** Rough cost of each endpoint, in provider requests. */
export const COST = { search: 4, flex: 1, explore: 10, meetupPerRoute: 1, via: 30 } as const;

interface Spent {
  /** [time, points] */
  recent: [number, number][];
  day: string;
  dayPoints: number;
}
const g = globalThis as { __searchSpent?: Map<string, Spent> };
const spent: Map<string, Spent> = (g.__searchSpent ??= new Map());

/** Takes `points` from the address's budget; false (and nothing taken) when over. Returns seconds to wait when refused. */
export function spend(client: string, points: number, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const day = new Date(now).toISOString().slice(0, 10);
  const s = spent.get(client) ?? { recent: [], day, dayPoints: 0 };
  if (s.day !== day) {
    s.day = day;
    s.dayPoints = 0;
  }
  s.recent = s.recent.filter(([t]) => now - t < WINDOW_MS);
  const inWindow = s.recent.reduce((sum, [, p]) => sum + p, 0);
  if (s.dayPoints + points > DAY_POINTS) {
    spent.set(client, s);
    return { ok: false, retryAfter: Math.ceil((Date.parse(`${day}T00:00:00Z`) + 86_400_000 - now) / 1000) };
  }
  if (inWindow + points > WINDOW_POINTS) {
    spent.set(client, s);
    const oldest = s.recent[0]?.[0] ?? now;
    return { ok: false, retryAfter: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)) };
  }
  s.recent.push([now, points]);
  s.dayPoints += points;
  spent.set(client, s);
  if (spent.size > 20_000) for (const [k, v] of spent) if (v.day !== day || !v.recent.some(([t]) => now - t < WINDOW_MS)) spent.delete(k);
  return { ok: true };
}

export function resetSearchBudgets(): void {
  spent.clear();
}

/** Caddy puts the real address first in X-Forwarded-For. */
export function clientAddress(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function key(env: NodeJS.ProcessEnv): Buffer {
  // Derived from the Turnstile secret, so no extra server setting is needed; it never leaves the server.
  return createHash("sha256").update(`remeeet-human|${env.TURNSTILE_SECRET_KEY?.trim() ?? ""}`).digest();
}

/** Cookie value `exp.nonce.sig`, valid for HUMAN_TTL_S. */
export function signHuman(now = Date.now(), env: NodeJS.ProcessEnv = process.env): string {
  const exp = Math.floor(now / 1000) + HUMAN_TTL_S;
  const body = `${exp}.${randomBytes(9).toString("base64url")}`;
  return `${body}.${createHmac("sha256", key(env)).update(body).digest("base64url")}`;
}

export function verifyHuman(value: string | undefined, now = Date.now(), env: NodeJS.ProcessEnv = process.env): boolean {
  if (!value || value.length > 200) return false;
  const i = value.lastIndexOf(".");
  if (i < 0) return false;
  const body = value.slice(0, i);
  const sig = Buffer.from(value.slice(i + 1), "base64url");
  const want = createHmac("sha256", key(env)).update(body).digest();
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return false;
  const exp = Number(body.split(".")[0]);
  return Number.isFinite(exp) && exp * 1000 > now;
}

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

/** Checks the human cookie and the address budget; returns an error response to send, or null to go on. */
export function guardSearch(req: Request, points: number, env: NodeJS.ProcessEnv = process.env): Response | null {
  if (turnstileEnabled(env) && !verifyHuman(readCookie(req, HUMAN_COOKIE), Date.now(), env)) return apiError("human_check", 403);
  const r = spend(clientAddress(req), points);
  if (!r.ok) {
    const res = apiError("search_limit", 429, { retryAfter: r.retryAfter });
    res.headers.set("retry-after", String(r.retryAfter));
    return res;
  }
  return null;
}
