import { describe, expect, it } from "vitest";
import { diffAlerts } from "@/lib/watch/checker";
import type { Watch } from "@/lib/watch/types";

const base: Watch = {
  id: "w",
  label: "WAW→BCN weekend",
  params: { kind: "search", request: { origin: "WAW", destination: "BCN", departDate: "2026-11-21", adults: 1, cabin: "economy", currency: "EUR" } },
  currency: "EUR",
  dropThreshold: 0.05,
  notify: {},
  active: true,
  createdAt: "",
  updatedAt: "",
  knownSignatures: ["s1", "s2"],
  history: [],
  alerts: [],
  lastBestPrice: 100,
  targetPrice: 80,
};

describe("diffAlerts", () => {
  it("detects drops, target and new offers", () => {
    const alerts = diffAlerts(base, { bestPrice: 79, count: 3, signatures: ["s1", "s2", "s3"] });
    expect(alerts.map((a) => a.type).sort()).toEqual(["new_offer", "price_drop", "target_reached"]);
  });
  it("ignores noise below threshold", () => {
    expect(diffAlerts(base, { bestPrice: 97, count: 2, signatures: ["s1", "s2"] })).toEqual([]);
  });
  it("flags big rises and disappearance", () => {
    expect(diffAlerts(base, { bestPrice: 130, count: 2, signatures: ["s1", "s2"] }).map((a) => a.type)).toEqual(["price_rise"]);
    expect(diffAlerts({ ...base, lastCount: 2 }, { bestPrice: null, count: 0, signatures: [] }).map((a) => a.type)).toEqual(["no_results"]);
  });
  it("first check is a silent baseline", () => {
    expect(diffAlerts({ ...base, lastBestPrice: undefined, knownSignatures: [], targetPrice: undefined }, { bestPrice: 50, count: 1, signatures: ["x"] })).toEqual([]);
  });
});

import { isSafeWebhookSyntax } from "@/lib/watch/webhook";
import { setWatchStore, watchStore } from "@/lib/watch/store";

describe("watch reliability", () => {
  it("does not repeat no_results while nothing is found", () => {
    const silent = { ...base, lastCount: 0 };
    expect(diffAlerts(silent, { bestPrice: null, count: 0, signatures: [] })).toEqual([]);
    expect(diffAlerts({ ...base, lastCount: 4 }, { bestPrice: null, count: 0, signatures: [] }).map((a) => a.type)).toEqual(["no_results"]);
  });
  it("raises nothing when a provider failed", () => {
    expect(diffAlerts(base, { bestPrice: 400, count: 1, signatures: ["s1"], complete: false })).toEqual([]);
  });
  it("shares one store across module copies", () => {
    setWatchStore(null);
    expect(watchStore()).toBe(watchStore());
    expect((globalThis as { __watchStore?: unknown }).__watchStore).toBe(watchStore());
    setWatchStore(null);
  });
  it("rejects internal webhook targets", () => {
    for (const u of ["http://169.254.169.254/x", "http://localhost:3000", "http://10.0.0.5", "http://[::1]/", "ftp://example.com", "http://u:p@example.com"]) {
      expect(isSafeWebhookSyntax(u)).toBe(false);
    }
    expect(isSafeWebhookSyntax("https://hooks.example.com/abc")).toBe(true);
  });
});
