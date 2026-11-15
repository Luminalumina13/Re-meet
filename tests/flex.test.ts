import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/providers/mock";
import { flexDay } from "@/lib/flex/day";
import { flexDates, flexGrid, priceRank } from "@/lib/flex/matrix";
import { flexDaySchema } from "@/lib/api/schemas";
import { IDEAL_WEEKEND_FILTERS } from "@/lib/domain/filters";
import { localMinutes } from "@/lib/domain/time";

describe("flex dates", () => {
  it("lists the days around a date and drops the past", () => {
    expect(flexDates("2026-11-28", 3)).toEqual(["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01"]);
    expect(flexDates("2026-11-28", 3, "2026-11-27")).toEqual(["2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01"]);
  });

  const opt = (price: number, depart: string, arrive: string) => ({ price, departUtc: depart, arriveUtc: arrive });

  it("pairs only flights that fit together and takes the cheapest combination", () => {
    const out = new Map([
      // cheap but lands the next afternoon, after the cheap return has left
      ["2026-11-21", [opt(94, "2026-11-21T18:20:00Z", "2026-11-22T14:35:00Z"), opt(150, "2026-11-21T18:20:00Z", "2026-11-22T07:50:00Z")]],
    ]);
    const back = new Map([
      ["2026-11-22", [opt(184, "2026-11-22T11:10:00Z", "2026-11-22T21:30:00Z")]],
      ["2026-11-23", [opt(120, "2026-11-23T11:10:00Z", "2026-11-23T21:30:00Z")]],
    ]);
    const cells = flexGrid(out, back, 120);
    // 22 Nov: the 94 € flight lands at 14:35, after the 11:10 return, so only the 150 € one works
    expect(cells.find((c) => c.ret === "2026-11-22")!.price).toBe(334);
    // 23 Nov: both fit, so the cheap one wins
    expect(cells.find((c) => c.ret === "2026-11-23")!.price).toBe(214);
  });

  it("drops pairs with a return before the departure or too short a stay", () => {
    const out = new Map([["2026-11-23", [opt(50, "2026-11-23T06:00:00Z", "2026-11-23T08:00:00Z")]]]);
    const back = new Map([
      ["2026-11-22", [opt(40, "2026-11-22T20:00:00Z", "2026-11-22T22:00:00Z")]],
      ["2026-11-23", [opt(40, "2026-11-23T09:00:00Z", "2026-11-23T11:00:00Z")]], // 1 h at the destination
    ]);
    expect(flexGrid(out, back)).toEqual([]);
    expect(flexGrid(out, back, 30)).toEqual([{ depart: "2026-11-23", ret: "2026-11-23", price: 90 }]);
  });

  it("skips days with no fare", () => {
    const out = new Map([["2026-11-21", []], ["2026-11-22", [opt(40, "2026-11-22T06:00:00Z", "2026-11-22T08:00:00Z")]]]);
    const back = new Map([["2026-11-24", [opt(30, "2026-11-24T20:00:00Z", "2026-11-24T22:00:00Z")]]]);
    expect(flexGrid(out, back)).toEqual([{ depart: "2026-11-22", ret: "2026-11-24", price: 70 }]);
  });

  it("ranks prices between 0 and 1", () => {
    expect(priceRank(10, 10, 30)).toBe(0);
    expect(priceRank(30, 10, 30)).toBe(1);
    expect(priceRank(5, 5, 5)).toBe(0);
  });

  it("finds the cheapest one-way fare of a day within the time window", async () => {
    const mock = new MockProvider({ volatilitySeed: 3 });
    const base = { origin: "WAW", destination: "BCN", adults: 1, children: 0, infants: 0, cabin: "economy" as const, currency: "EUR" };
    const any = await flexDay({ ...base, date: "2026-11-28", direction: "outbound" }, { providers: [mock], fresh: true });
    expect(any.price).toBeGreaterThan(0);
    const afternoon = await flexDay({ ...base, date: "2026-11-28", direction: "outbound", filters: { outbound: { departAfter: "14:00" } } }, { providers: [mock], fresh: true });
    expect(afternoon.price).toBeGreaterThanOrEqual(any.price!);
    expect(localMinutes(afternoon.departLocal!)).toBeGreaterThanOrEqual(14 * 60);
    // the return window is applied to the inbound direction only
    const back = await flexDay({ ...base, origin: "BCN", destination: "WAW", date: "2026-11-29", direction: "inbound", filters: IDEAL_WEEKEND_FILTERS }, { providers: [mock], fresh: true });
    expect(back.count).toBeGreaterThan(0);
  });

  it("offers fares that are not beaten on both price and timing", async () => {
    const mock = new MockProvider({ volatilitySeed: 3 });
    const base = { origin: "WAW", destination: "BCN", adults: 1, children: 0, infants: 0, cabin: "economy" as const, currency: "EUR" };
    const out = await flexDay({ ...base, date: "2026-11-28", direction: "outbound" }, { providers: [mock], fresh: true });
    expect(out.options.length).toBeGreaterThan(0);
    expect(out.options[0].price).toBe(out.price);
    for (let i = 1; i < out.options.length; i++) {
      expect(out.options[i].price).toBeGreaterThanOrEqual(out.options[i - 1].price);
      // every dearer option must land earlier than all cheaper ones
      expect(Date.parse(out.options[i].arriveUtc)).toBeLessThan(Math.min(...out.options.slice(0, i).map((o) => Date.parse(o.arriveUtc))));
    }
    const back = await flexDay({ ...base, origin: "BCN", destination: "WAW", date: "2026-11-29", direction: "inbound" }, { providers: [mock], fresh: true });
    for (let i = 1; i < back.options.length; i++) {
      expect(Date.parse(back.options[i].departUtc)).toBeGreaterThan(Math.max(...back.options.slice(0, i).map((o) => Date.parse(o.departUtc))));
    }
  });

  it("reports no fare when nothing fits", async () => {
    const r = await flexDay(
      { origin: "WAW", destination: "BCN", adults: 1, children: 0, infants: 0, cabin: "economy", currency: "EUR", date: "2026-11-28", direction: "outbound", filters: { outbound: { departAfter: "23:59", departBefore: "23:59" } } },
      { providers: [new MockProvider({ volatilitySeed: 3 })], fresh: true },
    );
    expect(r.price).toBeNull();
  });

  it("validates the day request", () => {
    expect(flexDaySchema.safeParse({ origin: "WAW", destination: "BCN", date: "2026-11-28" }).success).toBe(true);
    expect(flexDaySchema.safeParse({ origin: "WAW", destination: "BCN", date: "tomorrow" }).success).toBe(false);
  });
});
