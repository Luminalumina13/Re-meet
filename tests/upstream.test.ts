import { beforeEach, describe, expect, it } from "vitest";
import { Gate } from "@/lib/providers/gate";
import { ProviderError } from "@/lib/providers/types";
import { KiwiMcpProvider, clearKiwiMcpCache, type KiwiMcpItinerary, type KiwiMcpResult } from "@/lib/providers/kiwiMcp";
import { insideRange, rangeSearch } from "@/lib/flex/range";
import { rangeSearchSchema } from "@/lib/api/schemas";
import type { RangeSearchRequest } from "@/lib/providers/types";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("upstream gate", () => {
  it("lets at most `perMinute` requests through, then makes the rest wait or fail", async () => {
    let t = 0;
    const g = new Gate("t1", { concurrency: 10, perMinute: 2, maxWaitMs: 1000, now: () => t });
    const done: number[] = [];
    const a = g.run(async () => done.push(1));
    const b = g.run(async () => done.push(2));
    const c = g.run(async () => done.push(3)).catch((e) => e);
    await tick();
    expect(done).toEqual([1, 2]);
    t = 5000; // the third waited too long
    void g.run(async () => 0).catch(() => 0); // a new request looks at the queue
    expect(await c).toBeInstanceOf(ProviderError);
    await Promise.all([a, b]);
    expect(g.minute.calls).toBe(2);
    expect(g.minute.throttled).toBeGreaterThanOrEqual(1);
  });

  it("refills over the minute", async () => {
    let t = 0;
    const g = new Gate("t2", { concurrency: 10, perMinute: 60, now: () => t });
    for (let i = 0; i < 60; i++) await g.run(async () => i);
    t = 1000; // one more token a second
    await expect(g.run(async () => "ok")).resolves.toBe("ok");
  });

  it("pauses the source after a 429 and fails fast meanwhile", async () => {
    let t = 0;
    const g = new Gate("t3", { concurrency: 2, perMinute: 100, now: () => t });
    await g.run(async () => ({ status: 429, body: "" }));
    expect(g.isPaused()).toBe(true);
    let reached = false;
    await expect(
      g.run(async () => {
        reached = true;
        return 1;
      }),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(reached).toBe(false);
    t = 31_000;
    await expect(g.run(async () => ({ status: 200 }))).resolves.toEqual({ status: 200 });
  });

  it("pauses after several failures in a row, not after one", async () => {
    const t = 0;
    const g = new Gate("t4", { concurrency: 2, perMinute: 100, failuresToPause: 3, now: () => t });
    const fail = () => g.run(async () => ({ status: 502 }));
    await fail();
    await fail();
    expect(g.isPaused()).toBe(false);
    await fail();
    expect(g.isPaused()).toBe(true);
    expect(g.minute.errors).toBe(3);
  });

  it("an abort by the visitor is not an upstream failure", async () => {
    const g = new Gate("t5", { concurrency: 2, perMinute: 100, failuresToPause: 1 });
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    await expect(g.run(async () => Promise.reject(abort))).rejects.toBe(abort);
    expect(g.isPaused()).toBe(false);
  });
});

const day = (date: string, h: number) => `${date}T${String(h).padStart(2, "0")}:00:00`;
let n = 0;
function kiwiTrip(dep: string, ret: string | null, price: number): KiwiMcpItinerary {
  const leg = (from: string, to: string, date: string) => ({
    from,
    to,
    departureTime: day(date, 10),
    arrivalTime: day(date, 13),
    durationSeconds: 3 * 3600,
    stops: 0,
    segments: [{ from, to, departureTime: day(date, 10), arrivalTime: day(date, 13), durationSeconds: 3 * 3600, carrier: "FR", flightNumber: String(100 + ++n) }],
  });
  return { id: `k${++n}`, tripType: ret ? "return" : "oneway", price, outbound: leg("WAW", "BCN", dep), ...(ret ? { inbound: leg("BCN", "WAW", ret) } : {}) };
}

const rangeReq: RangeSearchRequest = {
  origin: "WAW",
  destination: "BCN",
  departDate: "2026-12-05",
  departUntil: "2026-12-11",
  returnDate: "2026-12-07",
  returnUntil: "2026-12-15",
  minNights: 2,
  maxNights: 4,
  adults: 1,
  cabin: "economy",
  currency: "EUR",
};

beforeEach(() => clearKiwiMcpCache());

describe("fewer calls to Kiwi", () => {
  it("a quick search is one call, a normal one keeps the time windows", () => {
    const p = new KiwiMcpProvider({ call: async () => ({ currency: "EUR", resultsCount: 0, itineraries: [] }) });
    const base = { origin: "WAW", destination: "BCN", departDate: "2026-12-05", adults: 1, cabin: "economy" as const, currency: "EUR" };
    expect(p.plan(base)).toHaveLength(4);
    expect(p.plan({ ...base, quick: true })).toHaveLength(1);
  });

  it("a date range takes at most 4 calls and passes nights or the return window", () => {
    const p = new KiwiMcpProvider({ call: async () => ({ currency: "EUR", resultsCount: 0, itineraries: [] }) });
    const byNights = p.rangePlan(rangeReq);
    expect(byNights.length).toBeLessThanOrEqual(4);
    expect(byNights[0]).toMatchObject({ departureDate: "05/12/2026", nights_in_dst_from: 2, nights_in_dst_to: 4 });
    expect(byNights[0].returnDate).toBeUndefined();
    expect(byNights[byNights.length - 1].departureDateTo ?? byNights[byNights.length - 1].departureDate).toBe("11/12/2026");
    const byDates = p.rangePlan({ ...rangeReq, minNights: undefined, maxNights: undefined });
    expect(byDates[0]).toMatchObject({ returnDate: "07/12/2026", returnDateTo: "15/12/2026" });
    expect(p.rangePlan({ ...rangeReq, departUntil: "2026-12-05" })).toHaveLength(1);
  });

  it("lists the cheapest trip per day pair inside the range", async () => {
    const res: KiwiMcpResult = {
      currency: "EUR",
      resultsCount: 4,
      itineraries: [kiwiTrip("2026-12-05", "2026-12-08", 120), kiwiTrip("2026-12-05", "2026-12-08", 99), kiwiTrip("2026-12-06", "2026-12-07", 50), kiwiTrip("2026-12-09", "2026-12-12", 80)],
    };
    let calls = 0;
    const kiwi = new KiwiMcpProvider({
      call: async () => {
        calls++;
        return res;
      },
    });
    const out = await rangeSearch(rangeReq, { providers: [kiwi], fresh: true });
    expect(out.supported).toBe(true);
    expect(calls).toBeLessThanOrEqual(4);
    // 6 → 7 is one night only: outside the 2–4 nights.
    expect(out.pairs).toEqual([
      { depart: "2026-12-09", ret: "2026-12-12", price: 80, providerName: "Kiwi.com" },
      { depart: "2026-12-05", ret: "2026-12-08", price: 99, providerName: "Kiwi.com" },
    ]);
  });

  it("says when no source can search a range", async () => {
    const out = await rangeSearch(rangeReq, { providers: [], fresh: true });
    expect(out).toMatchObject({ supported: false, pairs: [] });
  });

  it("one way ranges keep one-way trips only", () => {
    const req = { ...rangeReq, returnDate: undefined, returnUntil: undefined, minNights: undefined, maxNights: undefined };
    const p = new KiwiMcpProvider({ call: async () => ({ currency: "EUR", resultsCount: 0, itineraries: [] }) });
    const one = p.map(kiwiTrip("2026-12-06", null, 40), "EUR")!;
    const back = p.map(kiwiTrip("2026-12-06", "2026-12-09", 40), "EUR")!;
    expect(insideRange(one, req)).toBe(true);
    expect(insideRange(back, req)).toBe(false);
  });

  it("the API checks the range", () => {
    const body = { origin: "WAW", destination: "BCN", departDate: "2026-12-05", departUntil: "2026-12-11" };
    expect(rangeSearchSchema.safeParse(body).success).toBe(true);
    expect(rangeSearchSchema.safeParse({ ...body, departUntil: "2026-12-30" }).success).toBe(false);
    expect(rangeSearchSchema.safeParse({ ...body, quick: true }).data).not.toHaveProperty("quick");
  });
});
