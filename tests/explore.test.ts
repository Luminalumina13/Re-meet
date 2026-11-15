import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { explore, groupByCity, minutesThere } from "@/lib/explore/engine";
import { KiwiMcpProvider, clearKiwiMcpCache, type KiwiMcpResult } from "@/lib/providers/kiwiMcp";
import { MockProvider } from "@/lib/providers/mock";
import { IDEAL_WEEKEND_FILTERS, applyFilters, scoreAll } from "@/lib/domain/filters";
import type { ExploreRequest } from "@/lib/explore/types";
import { diffAlerts } from "@/lib/watch/checker";
import type { Watch } from "@/lib/watch/types";

const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures/kiwi-mcp-explore-waw.json"), "utf8")) as KiwiMcpResult;
const req: ExploreRequest = {
  origin: "WAW",
  departDate: "2026-11-21",
  returnDate: "2026-11-22",
  adults: 1,
  cabin: "economy",
  currency: "EUR",
  maxFlightHours: 4,
  filters: IDEAL_WEEKEND_FILTERS,
};

beforeEach(() => clearKiwiMcpCache());

describe("Kiwi.com anywhere search", () => {
  it("plans one call per departure window with the duration cap and one-per-city", () => {
    const plan = new KiwiMcpProvider({ call: async () => fixture }).explorePlan(req);
    expect(plan).toHaveLength(4);
    for (const a of plan) expect(a).toMatchObject({ flyFrom: "WAW", flyTo: "anywhere", one_for_city: true, max_fly_duration: 4, returnDate: "22/11/2026" });
    expect(plan[0].dtime_from).toBe(8);
  });

  it("fetches a second page starting from the first page's highest price", async () => {
    const calls: Record<string, unknown>[] = [];
    const p = new KiwiMcpProvider({
      call: async (_tool, args) => {
        calls.push(args);
        return fixture;
      },
    });
    await p.explore({ ...req, filters: {} });
    const maxPrice = Math.floor(Math.max(...fixture.itineraries.map((i) => i.price)));
    expect(calls.filter((c) => c.price_from === maxPrice).length).toBe(4);
    expect(calls).toHaveLength(8);
  });

  it("maps destination city, country and photo", async () => {
    const list = await new KiwiMcpProvider({ call: async () => fixture }).explore(req, undefined, 1);
    const src = fixture.itineraries[0];
    const last = src.outbound.segments[src.outbound.segments.length - 1];
    const mapped = list.find((i) => i.id === `kiwi-${src.id}`)!;
    expect(mapped.legs[0].toCity).toBe(last.toCity);
    expect(mapped.legs[0].toCountry).toBe(last.toCountry);
    expect(mapped.imageUrl).toBe(`https://images.kiwi.com/photos/600x600/${src.imageId}.jpg`);
  });
});

describe("explore engine", () => {
  it("groups by city, enforces the flight-time cap and the weekend windows", async () => {
    const res = await explore(req, { providers: [new KiwiMcpProvider({ call: async () => fixture })], fresh: true });
    expect(res.destinations.length).toBeGreaterThan(5);
    const keys = res.destinations.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("warsaw");
    for (const d of res.destinations) {
      for (const l of d.best.legs) expect(l.durationMin).toBeLessThanOrEqual(4 * 60);
      expect(d.best.legs[0].departLocal.slice(11) >= "08:00").toBe(true);
      expect(d.cheapest.price.amount).toBeLessThanOrEqual(d.best.price.amount);
      expect(d.minutesThere).toBe(minutesThere(d.best));
      expect(d.minutesThere).toBeGreaterThan(0);
    }
  });

  it("a tighter cap removes far destinations", async () => {
    const providers = [new KiwiMcpProvider({ call: async () => fixture })];
    const wide = await explore(req, { providers, fresh: true });
    const tight = await explore({ ...req, maxFlightHours: 2 }, { providers, fresh: true });
    expect(tight.destinations.length).toBeLessThan(wide.destinations.length);
    for (const d of tight.destinations) for (const l of d.best.legs) expect(l.durationMin).toBeLessThanOrEqual(120);
  });

  it("works on demo data and skips providers without explore support", async () => {
    const mock = new MockProvider({ volatilitySeed: 3 });
    const res = await explore(req, { providers: [mock], fresh: true });
    expect(res.destinations.length).toBeGreaterThan(3);
    const scored = scoreAll(applyFilters(await mock.explore(req), { ...IDEAL_WEEKEND_FILTERS, maxDurationMin: 240 }));
    expect(groupByCity(scored).length).toBe(res.destinations.length);
  });

  it("new destinations raise a new-offer alert on an explore watch", () => {
    const w = { currency: "EUR", dropThreshold: 0.05, label: "x", knownSignatures: ["rome|a"], lastBestPrice: 100 } as unknown as Watch;
    const alerts = diffAlerts(w, { bestPrice: 100, count: 2, signatures: ["rome|a", "malta|b"] });
    expect(alerts.map((a) => a.type)).toEqual(["new_offer"]);
  });
});
