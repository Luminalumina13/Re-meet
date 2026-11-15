import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KiwiMcpProvider, clearKiwiMcpCache, parseRpc, toLeg, type KiwiMcpResult } from "@/lib/providers/kiwiMcp";
import { LastminuteProvider, clearLastminuteCache, parseDuration, parsePoint, parseStops, type LmResult } from "@/lib/providers/lastminute";
import { dedupe } from "@/lib/providers/aggregator";
import { IDEAL_WEEKEND_FILTERS, applyFilters } from "@/lib/domain/filters";

const fx = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
const kiwiOw = fx("kiwi-mcp-oneway-waw-bcn.json") as KiwiMcpResult;
const lmOw = fx("lastminute-ow-waw-bcn.json") as LmResult;
const lmRt = fx("lastminute-rt-waw-bcn.json") as LmResult;
const base = { adults: 1, cabin: "economy" as const, currency: "EUR", origin: "WAW", destination: "BCN", departDate: "2026-11-21" };

beforeEach(() => {
  clearKiwiMcpCache();
  clearLastminuteCache();
});

describe("MCP transport", () => {
  it("parses SSE and plain JSON replies", () => {
    expect(parseRpc('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"isError":false}}\n\n').result?.isError).toBe(false);
    expect(parseRpc('{"jsonrpc":"2.0","id":1,"error":{"message":"x"}}').error?.message).toBe("x");
  });
});

describe("Kiwi.com MCP connector", () => {
  it("maps real results from many airlines with consistent absolute times", async () => {
    const p = new KiwiMcpProvider({ call: async () => kiwiOw });
    const list = await p.search(base);
    expect(list.length).toBe(kiwiOw.itineraries.length);
    const airlines = new Set(list.flatMap((i) => i.legs.flatMap((l) => l.segments.map((s) => s.carrier))));
    expect(airlines.size).toBeGreaterThanOrEqual(4);
    for (const it of list) {
      const leg = it.legs[0];
      expect(leg.durationMin).toBe(Math.round((Date.parse(leg.arriveUtc) - Date.parse(leg.departUtc)) / 60000));
      expect(leg.stops).toBe(leg.segments.length - 1);
      for (let i = 1; i < leg.segments.length; i++) {
        // connections never depart before the previous flight lands
        expect(Date.parse(leg.segments[i].departUtc)).toBeGreaterThanOrEqual(Date.parse(leg.segments[i - 1].arriveUtc));
      }
      expect(it.deepLink).toMatch(/^https:\/\/kiwi\.com\//);
    }
  });

  it("reconstructs UTC across time zones from durations", () => {
    // Lisbon (UTC+0) → Warsaw (UTC+1): 08:00 local dep, 3h50 flight, lands 12:50 local.
    const leg = toLeg({
      from: "LIS",
      to: "WAW",
      departureTime: "2026-11-21T08:00:00",
      arrivalTime: "2026-11-21T12:50:00",
      durationSeconds: 230 * 60,
      stops: 0,
      segments: [{ from: "LIS", to: "WAW", departureTime: "2026-11-21T08:00:00", arrivalTime: "2026-11-21T12:50:00", durationSeconds: 230 * 60, carrier: "LO", carrierName: "LOT", flightNumber: "LO434" }],
    });
    expect(leg.departUtc).toBe("2026-11-21T08:00:00.000Z");
    expect(leg.arriveUtc).toBe("2026-11-21T11:50:00.000Z");
    expect(leg.segments[0]).toMatchObject({ carrier: "LO", flightNumber: "434" });
  });

  it("splits the day into departure windows that respect the outbound filter", () => {
    const p = new KiwiMcpProvider({ call: async () => kiwiOw });
    const plan = p.plan({ ...base, returnDate: "2026-11-22", filters: IDEAL_WEEKEND_FILTERS });
    expect(plan.map((a) => [a.dtime_from, a.dtime_to])).toEqual([
      [8, 9],
      [10, 13],
      [14, 17],
      [18, 23],
    ]);
    expect(plan[0]).toMatchObject({ departureDate: "21/11/2026", returnDate: "22/11/2026", ret_atime_from: 17 });
    // 23:30 rounds to the last hour of the day, so no upper bound is sent.
    expect(plan[0].ret_atime_to).toBeUndefined();
  });

  it("keeps partial results when one window fails", async () => {
    let n = 0;
    const p = new KiwiMcpProvider({
      call: async () => {
        if (n++ === 0) throw new Error("boom");
        return kiwiOw;
      },
    });
    expect((await p.search(base)).length).toBeGreaterThan(0);
  });
});

describe("lastminute.com MCP connector", () => {
  it("parses its text fields", () => {
    expect(parseDuration("3 hours and 10 min")).toBe(190);
    expect(parseDuration("10 hours")).toBe(600);
    expect(parseDuration("45 min")).toBe(45);
    expect(parsePoint("BCN 10:30+1")).toEqual({ iata: "BCN", time: "10:30", plusDays: 1 });
    expect(parseStops("Direct")).toEqual([0]);
    expect(parseStops("1 stop")).toEqual([1]);
    expect(parseStops("Both Direct")).toEqual([0, 0]);
    expect(parseStops("Out: 1 | Ret: 0")).toEqual([1, 0]);
  });

  it("maps real one-way results, including next-day arrivals", async () => {
    const p = new LastminuteProvider({ call: async () => lmOw });
    const list = await p.search(base);
    expect(list.length).toBe(lmOw.flights.length);
    const wizz = list.find((i) => i.legs[0].departLocal === "2026-11-21T15:05" && i.legs[0].segments[0].carrier === "W6")!;
    expect(wizz.price.amount).toBe(115.39);
    expect(wizz.legs[0].arriveLocal).toBe("2026-11-21T18:15");
    expect(wizz.legs[0].stops).toBe(0);
    const overnight = list.find((i) => i.legs[0].arriveLocal.startsWith("2026-11-22"))!;
    expect(overnight.legs[0].stops).toBe(1);
    expect(overnight.legs[0].durationMin).toBe(Math.round((Date.parse(overnight.legs[0].arriveUtc) - Date.parse(overnight.legs[0].departUtc)) / 60000));
  });

  it("maps round trips with a different airline on the way back", async () => {
    const p = new LastminuteProvider({ call: async () => lmRt });
    const list = await p.search({ ...base, returnDate: "2026-11-22" });
    const mixed = list.find((i) => i.legs[1]?.to === "WMI")!;
    expect(mixed.legs[0].segments[0].carrier).toBe("W6");
    expect(mixed.legs[1].segments[0]).toMatchObject({ carrier: "FR", carrierName: "Ryanair" });
    expect(mixed.legs[1].departLocal).toBe("2026-11-22T10:00");
  });

  it("drops results priced in another currency", async () => {
    const p = new LastminuteProvider({ call: async () => lmOw });
    expect(await p.search({ ...base, currency: "PLN" })).toEqual([]);
  });
});

describe("cross-source merge", () => {
  it("merges the same flight from Kiwi.com and lastminute.com, keeping detail and comparing prices", async () => {
    const kiwi = await new KiwiMcpProvider({ call: async () => kiwiOw }).search(base);
    const lm = await new LastminuteProvider({ call: async () => lmOw }).search(base);
    const merged = dedupe([...kiwi, ...lm]);
    expect(merged.length).toBeLessThan(kiwi.length + lm.length);
    const both = merged.filter((m) => m.otherOffers?.length);
    expect(both.length).toBeGreaterThan(0);
    for (const m of both) {
      // the shown price is the cheapest of all sources
      expect(m.otherOffers!.every((o) => o.price.amount >= m.price.amount)).toBe(true);
      // the richer description (with flight numbers) wins
      expect(m.legs[0].segments.every((s) => s.flightNumber)).toBe(true);
    }
  });
});

describe("date-aware arrival windows", () => {
  it("a return that lands the next day is not an evening return", async () => {
    const lm = await new LastminuteProvider({ call: async () => lmOw }).search(base);
    const late = lm.find((i) => i.legs[0].arriveLocal.startsWith("2026-11-22"))!;
    expect(applyFilters([late], { outbound: { arriveAfter: "08:00", arriveBefore: "23:30" } })).toEqual([]);
  });
});
