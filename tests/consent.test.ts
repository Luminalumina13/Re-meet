import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// consent.ts reads its IDs at import time, so each case loads a fresh copy.
async function load(env: Record<string, string>) {
  vi.resetModules();
  // Start from "nothing configured" so ids set in the CI environment cannot leak into a case.
  const all = { NEXT_PUBLIC_GA_ID: "", NEXT_PUBLIC_GTM_ID: "", NEXT_PUBLIC_ADSENSE_CLIENT: "", ...env };
  for (const [k, v] of Object.entries(all)) vi.stubEnv(k, v);
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  const gtag = vi.fn();
  vi.stubGlobal("window", { gtag, addEventListener: () => {}, removeEventListener: () => {} });
  return { mod: await import("@/lib/consent"), gtag };
}

describe("consent gating", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is off when no ids are configured", async () => {
    const { mod } = await load({});
    expect(mod.trackingConfigured).toBe(false);
  });

  it("sends events only after the visitor accepted", async () => {
    const { mod, gtag } = await load({ NEXT_PUBLIC_GA_ID: "G-TEST123" });
    expect(mod.trackingConfigured).toBe(true);
    mod.track("search", { kind: "flights" });
    expect(gtag).not.toHaveBeenCalled();
    mod.saveConsent("denied");
    mod.track("search");
    expect(gtag).not.toHaveBeenCalled();
    mod.saveConsent("granted");
    mod.track("search", { kind: "flights" });
    expect(gtag).toHaveBeenCalledWith("event", "search", { kind: "flights" });
  });

  it("treats a Tag Manager container as configured and gates its events too", async () => {
    const { mod, gtag } = await load({ NEXT_PUBLIC_GTM_ID: "GTM-TEST123" });
    expect(mod.trackingConfigured).toBe(true);
    mod.track("search");
    expect(gtag).not.toHaveBeenCalled();
    mod.saveConsent("granted");
    mod.track("search");
    expect(gtag).toHaveBeenCalledWith("event", "search", {});
  });
});
