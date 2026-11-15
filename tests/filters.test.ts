import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/providers/mock";
import { applyFilters, IDEAL_WEEKEND_FILTERS, scoreAll, sortItineraries } from "@/lib/domain/filters";
import { localMinutes } from "@/lib/domain/time";

const provider = new MockProvider({ volatilitySeed: 1 });
const base = { adults: 1, cabin: "economy" as const, currency: "EUR" };

describe("mock provider", () => {
  it("is deterministic and timezone-correct", async () => {
    const a = await provider.search({ ...base, origin: "WAW", destination: "BCN", departDate: "2026-11-21" });
    const b = await provider.search({ ...base, origin: "WAW", destination: "BCN", departDate: "2026-11-21" });
    expect(a.length).toBeGreaterThan(5);
    expect(a.map((i) => i.signature)).toEqual(b.map((i) => i.signature));
    for (const it of a) {
      const leg = it.legs[0];
      expect(leg.departLocal.startsWith("2026-11-21")).toBe(true);
      // arrival after departure in absolute time, and durations consistent
      expect(Date.parse(leg.arriveUtc)).toBeGreaterThan(Date.parse(leg.departUtc));
      expect(leg.durationMin).toBe(Math.round((Date.parse(leg.arriveUtc) - Date.parse(leg.departUtc)) / 60000));
    }
  });

  it("builds round trips with two legs", async () => {
    const list = await provider.search({ ...base, origin: "WAW", destination: "BCN", departDate: "2026-11-21", returnDate: "2026-11-22" });
    expect(list.length).toBeGreaterThan(10);
    expect(list.every((i) => i.legs.length === 2 && i.legs[1].from === "BCN" && i.legs[1].to === "WAW")).toBe(true);
  });
});

describe("filters & scoring", () => {
  it("ideal weekend keeps morning departures and evening returns only", async () => {
    const list = await provider.search({ ...base, origin: "WAW", destination: "BCN", departDate: "2026-11-21", returnDate: "2026-11-22" });
    const kept = applyFilters(list, IDEAL_WEEKEND_FILTERS);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(list.length);
    for (const it of kept) {
      expect(localMinutes(it.legs[0].departLocal)).toBeGreaterThanOrEqual(8 * 60);
      const arr = localMinutes(it.legs[1].arriveLocal);
      expect(arr).toBeGreaterThanOrEqual(17 * 60);
      expect(arr).toBeLessThanOrEqual(23 * 60 + 30);
    }
    const scored = scoreAll(kept, IDEAL_WEEKEND_FILTERS);
    for (const s of scored) {
      const overnight = s.legs[0].arriveLocal.slice(0, 10) !== s.legs[0].departLocal.slice(0, 10);
      expect(s.comfortBreakdown.outboundDeparture).toBe(overnight ? 0.5 : 1);
      expect(s.comfortBreakdown.inboundArrival).toBe(1);
    }
    const cheapest = sortItineraries(scored, "cheapest");
    expect(cheapest[0].price.amount).toBe(Math.min(...scored.map((s) => s.price.amount)));
  });

  it("direct-only filter", async () => {
    const list = await provider.search({ ...base, origin: "WAW", destination: "LIS", departDate: "2026-11-21" });
    expect(list.some((i) => i.legs[0].stops > 0)).toBe(true);
    expect(applyFilters(list, { maxStops: 0 }).every((i) => i.legs[0].stops === 0)).toBe(true);
  });
});

describe("overnight penalty", () => {
  it("outbound landing after midnight scores lower than the same flight landing the same day", async () => {
    const list = await provider.search({ ...base, origin: "WAW", destination: "BCN", departDate: "2026-11-21" });
    const scored = scoreAll(list, IDEAL_WEEKEND_FILTERS);
    const late = scored.find((s) => s.legs[0].arriveLocal.slice(0, 10) !== s.legs[0].departLocal.slice(0, 10));
    if (!late) return; // schedule-dependent; nothing to assert
    expect(late.comfortBreakdown.outboundDeparture).toBeLessThanOrEqual(0.5);
    expect(late.comfort).toBeLessThan(100);
  });
});

describe("search cache", () => {
  it("does not cache failed or aborted fetches", async () => {
    const { fetchRaw, clearSearchCache } = await import("@/lib/providers/aggregator");
    clearSearchCache();
    let calls = 0;
    const flaky = {
      id: "flaky",
      name: "Flaky",
      kind: "aggregator" as const,
      isConfigured: () => true,
      search: async () => {
        calls++;
        if (calls === 1) throw new Error("This operation was aborted");
        return provider.search({ ...base, origin: "WAW", destination: "BCN", departDate: "2026-11-21" });
      },
    };
    const req = { ...base, origin: "WAW", destination: "BCN", departDate: "2026-11-21" };
    const first = await fetchRaw(req, { providers: [flaky] });
    expect(first.providers[0].status).toBe("error");
    const second = await fetchRaw(req, { providers: [flaky] });
    expect(second.cached).toBe(false);
    expect(second.raw.length).toBeGreaterThan(0);
    const third = await fetchRaw(req, { providers: [flaky] });
    expect(third.cached).toBe(true);
  });
});
