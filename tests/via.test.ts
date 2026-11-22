import { describe, expect, it } from "vitest";
import { planVia, suggestHubs, type ViaSets } from "@/lib/meetup/via";
import type { Itinerary } from "@/lib/domain/types";
import type { MeetupRequest } from "@/lib/meetup/types";

let n = 0;
const fl = (from: string, to: string, dep: string, arr: string, price: number): Itinerary =>
  ({
    id: `i${++n}`,
    provider: "mock",
    providerName: "Mock",
    signature: `${from}${to}${dep}`,
    price: { amount: price, currency: "EUR" },
    legs: [{ from, to, departUtc: dep, arriveUtc: arr, departLocal: dep, arriveLocal: arr, durationMin: 60, stops: 0, segments: [] }],
  }) as Itinerary;

const req: MeetupRequest = {
  friends: [
    { id: "a", name: "A", origins: ["VLC"] },
    { id: "b", name: "B", origins: ["LCA"] },
  ],
  destinations: ["BRI"],
  departDate: "2026-12-05",
  returnDate: "2026-12-07",
  cabin: "economy",
  currency: "EUR",
  valuePerHour: 15,
};

const sets = (over: Partial<ViaSets> = {}): ViaSets => ({
  destination: "BRI",
  hub: "FCO",
  toHub: new Map([
    ["a", [fl("VLC", "FCO", "2026-12-05T07:00Z", "2026-12-05T09:00Z", 40)]],
    ["b", [fl("LCA", "FCO", "2026-12-05T08:00Z", "2026-12-05T11:00Z", 60)]],
  ]),
  shared: [fl("FCO", "BRI", "2026-12-05T13:00Z", "2026-12-05T14:00Z", 30), fl("FCO", "BRI", "2026-12-05T11:30Z", "2026-12-05T12:30Z", 10)],
  sharedBack: [fl("BRI", "FCO", "2026-12-07T15:00Z", "2026-12-07T16:00Z", 30)],
  fromHub: new Map([
    ["a", [fl("FCO", "VLC", "2026-12-07T18:00Z", "2026-12-07T20:00Z", 40)]],
    ["b", [fl("FCO", "LCA", "2026-12-07T18:30Z", "2026-12-07T21:30Z", 60)]],
  ]),
  direct: new Map([
    ["a", [fl("BRI", "VLC", "2026-12-07T17:00Z", "2026-12-07T19:30Z", 90)]],
    ["b", [fl("BRI", "LCA", "2026-12-07T19:00Z", "2026-12-07T21:00Z", 80)]],
  ]),
  ...over,
});

describe("planVia", () => {
  it("meets at the hub before the shared flight and tries both ways back", () => {
    const plans = planVia(req, sets());
    // The 11:30 shared flight leaves too soon after B lands at 11:00, so only the 13:00 one works.
    expect(plans.every((p) => p.shared.legs[0].departUtc === "2026-12-05T13:00Z")).toBe(true);
    expect(plans.every((p) => p.hubWaitMinutes === 120)).toBe(true);
    const together = plans.find((p) => p.back === "together")!;
    expect(together.totalPrice).toBe(40 + 60 + 30 * 2 + 30 * 2 + 40 + 60);
    expect(together.meetEndUtc).toBe("2026-12-07T15:00:00.000Z");
    const separate = plans.find((p) => p.back === "separate")!;
    expect(separate.totalPrice).toBe(40 + 60 + 30 * 2 + 90 + 80);
    expect(separate.meetEndUtc).toBe("2026-12-07T17:00:00.000Z");
    expect(separate.friends.find((f) => f.friend.id === "b")!.price).toBe(60 + 30 + 80);
  });

  it("lets a friend who lives at the hub just wait there", () => {
    const r = { ...req, friends: [req.friends[0], { id: "b", name: "B", origins: ["FCO"] }] };
    const plans = planVia(r, sets({ toHub: new Map([["a", sets().toHub.get("a")!]]), direct: new Map([["a", sets().direct.get("a")!], ["b", [fl("BRI", "FCO", "2026-12-07T19:00Z", "2026-12-07T20:00Z", 25)]]]) }));
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].friends.find((f) => f.friend.id === "b")!.toHub).toBeNull();
  });

  it("gives nothing when someone cannot reach the hub", () => {
    expect(planVia(req, sets({ toHub: new Map([["a", []], ["b", []]]) }))).toEqual([]);
  });
});

describe("suggestHubs", () => {
  it("proposes hubs on the way, a friend's city allowed, never the destination", () => {
    const hubs = suggestHubs([["VLC"], ["LCA"]], "BRI", 3);
    expect(hubs.length).toBeGreaterThan(0);
    expect(hubs).not.toContain("BRI");
  });
  it("uses the friend's own city when the other flies over it", () => {
    expect(suggestHubs([["KBP"], ["WAW"]], "LIS", 3)).toContain("WAW");
  });
});
