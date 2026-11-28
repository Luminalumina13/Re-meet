import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KiwiMcpProvider, clearKiwiMcpCache, type KiwiMcpResult } from "@/lib/providers/kiwiMcp";
import { dedupe, fetchRaw } from "@/lib/providers/aggregator";
import { MockProvider } from "@/lib/providers/mock";
import { forBags, type Itinerary } from "@/lib/domain/types";
import { searchRequestSchema } from "@/lib/api/schemas";
import { buildExploreQuery, buildMeetupQuery, buildSearchQuery, parseExploreQuery, parseMeetupQuery, parseSearchQuery } from "@/lib/share";

const kiwiOw = JSON.parse(readFileSync(join(__dirname, "fixtures", "kiwi-mcp-oneway-waw-bcn.json"), "utf8")) as KiwiMcpResult;
const req = { adults: 2, children: 1, cabin: "economy" as const, currency: "EUR", origin: "WAW", destination: "BCN", departDate: "2026-11-21" };

beforeEach(() => clearKiwiMcpCache());

describe("bags at Kiwi", () => {
  it("asks for the bags of every paying traveller", () => {
    const p = new KiwiMcpProvider({ call: async () => kiwiOw });
    const [args] = p.plan({ ...req, filters: { bags: { cabin: 1, checked: 1 } } });
    expect(args.adults_hand_bags).toEqual([1, 1]);
    expect(args.adults_hold_bags).toEqual([1, 1]);
    expect(args.children_hand_bags).toEqual([1]);
    expect(args.children_hold_bags).toEqual([1]);
  });

  it("sends nothing when no bags are wanted", () => {
    const [args] = new KiwiMcpProvider({ call: async () => kiwiOw }).plan({ ...req, filters: { bags: { cabin: 0 } } });
    expect(args.adults_hand_bags).toBeUndefined();
    expect(args.adults_hold_bags).toBeUndefined();
  });

  it("keeps what the fare includes", async () => {
    const list = await new KiwiMcpProvider({ call: async () => kiwiOw }).search(req);
    expect(list[0].baggage).toEqual({ personalItem: expect.any(Number), cabinBag: expect.any(Number), checkedBag: expect.any(Number) });
  });
});

const fare = (provider: string, amount: number, baggage?: Itinerary["baggage"]) =>
  ({ id: provider, provider, providerName: provider, legs: [{ from: "RMO", to: "VLC", departUtc: "2026-12-22T19:50:00Z", arriveUtc: "2026-12-22T23:45:00Z", segments: [{ carrier: "W4", flightNumber: "3982", departUtc: "2026-12-22T19:50:00Z" }] }], price: { amount, currency: "EUR" }, signature: "s", baggage }) as unknown as Itinerary;

describe("comparing fares with and without bags", () => {
  const bare = fare("ryanair", 202);
  const withBag = fare("kiwi", 357, { personalItem: 1, cabinBag: 1, checkedBag: 0 });

  it("the offer that includes the bags leads, the bare fare is listed as also on", () => {
    const [one] = dedupe([bare, withBag], { cabin: 1 });
    expect(one.provider).toBe("kiwi");
    expect(one.otherOffers?.[0]).toMatchObject({ provider: "ryanair", baggage: undefined });
  });

  it("without bags the cheapest leads as before", () => {
    expect(dedupe([bare, withBag])[0].provider).toBe("ryanair");
  });

  it("picks bag-priced fares when any source quoted them", () => {
    expect(forBags([bare, withBag], { checked: 1 })).toEqual([withBag]);
    expect(forBags([bare], { checked: 1 })).toEqual([bare]);
    expect(forBags([bare, withBag])).toEqual([bare, withBag]);
  });
});

describe("search with bags", () => {
  it("does not reuse fares fetched without bags", async () => {
    const p = new MockProvider();
    const plain = await fetchRaw(req, { providers: [p] });
    const bagged = await fetchRaw({ ...req, filters: { bags: { checked: 1 } } }, { providers: [p] });
    expect(bagged.cached).toBe(false);
    expect(plain.raw.some((it) => it.baggage)).toBe(false);
    expect(bagged.raw.some((it) => it.baggage?.checkedBag === 3)).toBe(true);
  });

  it("validates the bag counts", () => {
    expect(searchRequestSchema.safeParse({ ...req, filters: { bags: { cabin: 1, checked: 2 } } }).success).toBe(true);
    expect(searchRequestSchema.safeParse({ ...req, filters: { bags: { checked: 3 } } }).success).toBe(false);
    expect(searchRequestSchema.safeParse({ ...req, filters: { bags: { cabin: 2 } } }).success).toBe(false);
  });
});

describe("share links keep the bags", () => {
  it("search, anywhere and meetup", () => {
    const s = parseSearchQuery(new URLSearchParams(buildSearchQuery({ origin: "KIV", destination: "VLC", mode: "custom", departDate: "2026-12-22", bags: { cabin: 1, checked: 1 } })));
    expect(s.bags).toEqual({ cabin: 1, checked: 1 });
    const e = parseExploreQuery(new URLSearchParams(buildExploreQuery({ origin: "KIV", bags: { checked: 1 } })));
    expect(e.bags).toEqual({ checked: 1 });
    const m = parseMeetupQuery(
      new URLSearchParams(buildMeetupQuery({ friends: [{ name: "A", origins: ["KIV"] }, { name: "B", origins: ["WAW"] }], destinations: ["VLC"], mode: "weekend", bags: { cabin: 1 } })),
    );
    expect(m.bags).toEqual({ cabin: 1 });
    expect(parseSearchQuery(new URLSearchParams("from=KIV&bag=weird")).bags).toBeUndefined();
  });
});
