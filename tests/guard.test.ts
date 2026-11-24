import { beforeEach, describe, expect, it } from "vitest";
import { DAY_POINTS, WINDOW_MS, WINDOW_POINTS, guardSearch, resetSearchBudgets, signHuman, spend, verifyHuman, HUMAN_COOKIE } from "@/lib/api/guard";

const env = { TURNSTILE_SECRET_KEY: "s3cret" } as unknown as NodeJS.ProcessEnv;
const req = (cookie?: string, ip = "1.2.3.4") => new Request("http://x/api/search", { method: "POST", headers: { "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) } });

beforeEach(() => resetSearchBudgets());

describe("search budget", () => {
  it("refuses once the 10-minute budget is spent and frees it later", () => {
    const t = Date.UTC(2026, 10, 24, 12);
    expect(spend("a", WINDOW_POINTS, t).ok).toBe(true);
    const r = spend("a", 1, t + 1000);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.retryAfter).toBeGreaterThan(0);
    expect(spend("b", 1, t + 1000).ok).toBe(true);
    expect(spend("a", 1, t + WINDOW_MS + 1).ok).toBe(true);
  });
  it("has a daily cap", () => {
    const t = Date.UTC(2026, 10, 24, 1);
    let i = 0;
    for (; i < 100; i++) if (!spend("a", 500, t + i * WINDOW_MS).ok) break;
    expect(i).toBe(DAY_POINTS / 500);
  });
});

describe("human cookie", () => {
  it("accepts its own signature until it expires, nothing else", () => {
    const now = Date.now();
    const v = signHuman(now, env);
    expect(verifyHuman(v, now, env)).toBe(true);
    expect(verifyHuman(v, now + 2 * 3600_000, env)).toBe(false);
    expect(verifyHuman(v.replace(/.$/, (c) => (c === "A" ? "B" : "A")), now, env)).toBe(false);
    expect(verifyHuman(v, now, { TURNSTILE_SECRET_KEY: "other" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(verifyHuman(undefined, now, env)).toBe(false);
  });
  it("guard asks for the check without the cookie and lets a checked browser through", async () => {
    const r = guardSearch(req(), 4, env);
    expect(r?.status).toBe(403);
    expect((await r!.json()).code).toBe("human_check");
    expect(guardSearch(req(`a=b; ${HUMAN_COOKIE}=${signHuman(Date.now(), env)}`), 4, env)).toBeNull();
  });
  it("skips the check where Turnstile is not set up (local development)", () => {
    expect(guardSearch(req(), 4, {} as NodeJS.ProcessEnv)).toBeNull();
  });
  it("answers 429 with Retry-After when over budget", () => {
    const e = {} as NodeJS.ProcessEnv;
    expect(guardSearch(req(undefined, "9.9.9.9"), WINDOW_POINTS, e)).toBeNull();
    const r = guardSearch(req(undefined, "9.9.9.9"), 1, e);
    expect(r?.status).toBe(429);
    expect(r?.headers.get("retry-after")).toBeTruthy();
  });
});
