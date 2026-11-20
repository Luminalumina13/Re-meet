import { describe, expect, it, vi } from "vitest";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";

const ok = (success: boolean) => vi.fn(async () => new Response(JSON.stringify({ success }))) as unknown as typeof fetch;

describe("turnstile", () => {
  it("is skipped without a secret key", async () => {
    expect(turnstileEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(await verifyTurnstile(undefined, "1.1.1.1", {} as NodeJS.ProcessEnv)).toBe(true);
  });
  const env = { TURNSTILE_SECRET_KEY: "s" } as unknown as NodeJS.ProcessEnv;
  it("rejects a missing token", async () => {
    expect(await verifyTurnstile(undefined, "1.1.1.1", env, ok(true))).toBe(false);
  });
  it("accepts and rejects by Cloudflare's answer", async () => {
    expect(await verifyTurnstile("tok", "1.1.1.1", env, ok(true))).toBe(true);
    expect(await verifyTurnstile("tok", "1.1.1.1", env, ok(false))).toBe(false);
  });
  it("fails closed when Cloudflare is unreachable", async () => {
    const boom = vi.fn(async () => { throw new Error("net"); }) as unknown as typeof fetch;
    expect(await verifyTurnstile("tok", undefined, env, boom)).toBe(false);
  });
});
