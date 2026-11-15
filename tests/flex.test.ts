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

  it("pairs each departure with the same or a later return and skips missing fares", () => {
    const out = new Map<string, number | null>([["2026-11-27", 50], ["2026-11-28", 40], ["2026-11-29", null]]);
    const back = new Map<string, number | null>([["2026-11-28", 30], ["2026-11-29", null], ["2026-11-30", 20]]);
    const cells = flexGrid(out, back);
    expect(cells).toEqual([
      { depart: "2026-11-27", ret: "2026-11-28", price: 80 },
      { depart: "2026-11-27", ret: "2026-11-30", price: 70 },
      { depart: "2026-11-28", ret: "2026-11-28", price: 70 },
      { depart: "2026-11-28", ret: "2026-11-30", price: 60 },
    ]);
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
