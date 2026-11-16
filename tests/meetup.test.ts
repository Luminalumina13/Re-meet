import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/providers/mock";
import { meetup, paretoFrontier, planMeetup, type CandidateSets } from "@/lib/meetup/engine";
import type { MeetupRequest } from "@/lib/meetup/types";
import { IDEAL_WEEKEND_FILTERS } from "@/lib/domain/filters";
import type { Itinerary } from "@/lib/domain/types";
import { finalize, legFromSegments } from "@/lib/providers/util";

const req: MeetupRequest = {
  friends: [
    { id: "a", name: "Ann", origins: ["WAW"] },
    { id: "b", name: "Bo", origins: ["BER"] },
    { id: "c", name: "Cy", origins: ["LIS"] },
  ],
  destinations: ["BCN"],
  departDate: "2026-11-21",
  returnDate: "2026-11-22",
  cabin: "economy",
  currency: "EUR",
  filters: IDEAL_WEEKEND_FILTERS,
  valuePerHour: 15,
};

function oneWay(id: string, from: string, to: string, depUtc: string, durMin: number, price: number): Itinerary {
  const arrUtc = new Date(Date.parse(depUtc) + durMin * 60000).toISOString();
  return finalize({
    id,
    provider: "t",
    providerName: "t",
    legs: [
      legFromSegments([
        { from, to, departLocal: depUtc.slice(0, 16), arriveLocal: arrUtc.slice(0, 16), departUtc: depUtc, arriveUtc: arrUtc, carrier: "XX", flightNumber: id, durationMin: durMin },
      ]),
    ],
    price: { amount: price, currency: "EUR" },
  });
}

describe("planMeetup (pure)", () => {
  it("maximises time together net of price, and respects hosts", () => {
    const sets: CandidateSets = {
      outbound: new Map([
        ["a", [oneWay("a1", "WAW", "BCN", "2026-11-21T06:00:00.000Z", 180, 100), oneWay("a2", "WAW", "BCN", "2026-11-21T12:00:00.000Z", 180, 40)]],
        ["b", [oneWay("b1", "BER", "BCN", "2026-11-21T07:00:00.000Z", 150, 90)]],
      ]),
      inbound: new Map([
        ["a", [oneWay("a3", "BCN", "WAW", "2026-11-22T18:00:00.000Z", 180, 80), oneWay("a4", "BCN", "WAW", "2026-11-22T10:00:00.000Z", 180, 30)]],
        ["b", [oneWay("b2", "BCN", "BER", "2026-11-22T19:00:00.000Z", 150, 70)]],
      ]),
    };
    const r = { ...req, friends: [...req.friends.slice(0, 2), { id: "h", name: "Host", origins: ["BCN"] }] };
    const { plans, unreachable } = planMeetup(r, "BCN", sets);
    expect(unreachable).toEqual([]);
    expect(plans.length).toBeGreaterThan(1);
    const best = plans[0];
    // At 15 €/h, the early flight (+6h together for +60 €) and late return (+8h for +50 €) both pay off.
    expect(best.friends.find((f) => f.friend.id === "a")!.outbound!.id).toBe("a1");
    expect(best.friends.find((f) => f.friend.id === "a")!.inbound!.id).toBe("a3");
    expect(best.friends.find((f) => f.friend.id === "h")!.price).toBe(0);
    // start = max arrival (b1 at 09:30Z), end = min departure (a3 at 18:00Z next day)
    expect(best.meetStartUtc).toBe("2026-11-21T09:30:00.000Z");
    expect(best.meetEndUtc).toBe("2026-11-22T18:00:00.000Z");
    expect(best.togetherMinutes).toBe(32.5 * 60);
    expect(best.totalPrice).toBe(100 + 90 + 80 + 70);

    // With cheap hours, the planner prefers the cheap flights.
    const cheap = planMeetup({ ...r, valuePerHour: 1 }, "BCN", sets).plans[0];
    expect(cheap.friends.find((f) => f.friend.id === "a")!.outbound!.id).toBe("a2");
    expect(cheap.friends.find((f) => f.friend.id === "a")!.inbound!.id).toBe("a4");

    const frontier = paretoFrontier(plans);
    expect(frontier.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < frontier.length; i++) {
      expect(frontier[i].totalPrice).toBeGreaterThan(frontier[i - 1].totalPrice);
      expect(frontier[i].togetherMinutes).toBeGreaterThan(frontier[i - 1].togetherMinutes);
    }
  });

  it("reports unreachable friends", () => {
    const sets: CandidateSets = { outbound: new Map([["a", []]]), inbound: new Map() };
    const r = planMeetup({ ...req, friends: req.friends.slice(0, 1).concat({ id: "h", name: "H", origins: ["BCN"] }) }, "BCN", sets);
    expect(r.plans).toEqual([]);
    expect(r.unreachable).toHaveLength(2);
  });
});

describe("meetup end-to-end over mock provider", () => {
  it("produces consistent plans for several friends and destinations", async () => {
    const res = await meetup({ ...req, destinations: ["BCN", "ROM".replace("ROM", "FCO")] }, { providers: [new MockProvider({ volatilitySeed: 7 })], fresh: true });
    expect(res.plans.length).toBeGreaterThan(0);
    for (const p of res.plans) {
      const travellers = p.friends.filter((f) => f.outbound);
      const start = Math.max(...travellers.map((f) => Date.parse(f.arriveUtc!)));
      const end = Math.min(...travellers.map((f) => Date.parse(f.departUtc!)));
      expect(p.togetherMinutes).toBe(Math.round((end - start) / 60000));
      expect(p.totalPrice).toBe(Math.round(p.friends.reduce((s, f) => s + f.price, 0)));
      for (const f of travellers) {
        expect(f.outbound!.legs[0].to).toBe(p.destination);
        expect(f.inbound!.legs[0].from).toBe(p.destination);
        // ideal-weekend windows applied per friend
        expect(f.outbound!.legs[0].departLocal.slice(11)).not.toMatch(/^0[0-7]:/);
      }
    }
    expect(res.plans[0].score).toBeGreaterThanOrEqual(res.plans[res.plans.length - 1].score);
  });
});

describe("friends with several airports", () => {
  const sets: CandidateSets = {
    outbound: new Map([
      // Ann can fly from WAW (expensive) or WMI (cheap); Bo only from BER.
      ["a", [oneWay("a-waw", "WAW", "BCN", "2026-11-21T08:00:00.000Z", 180, 150), oneWay("a-wmi", "WMI", "BCN", "2026-11-21T08:00:00.000Z", 180, 40)]],
      ["b", [oneWay("b1", "BER", "BCN", "2026-11-21T08:00:00.000Z", 150, 60)]],
    ]),
    inbound: new Map([
      // The cheap return goes to WAW, not WMI, so WMI+WAW must not be mixed.
      ["a", [oneWay("a-back-waw", "BCN", "WAW", "2026-11-22T18:00:00.000Z", 180, 20), oneWay("a-back-wmi", "BCN", "WMI", "2026-11-22T18:00:00.000Z", 180, 60)]],
      ["b", [oneWay("b2", "BCN", "BER", "2026-11-22T18:00:00.000Z", 150, 50)]],
    ]),
  };
  const r = { ...req, friends: [{ id: "a", name: "Ann", origins: ["WAW", "WMI"] }, { id: "b", name: "Bo", origins: ["BER"] }] };

  it("picks the cheapest airport and returns to the same one", () => {
    const { plans, unreachable } = planMeetup(r, "BCN", sets);
    expect(unreachable).toEqual([]);
    const a = plans[0].friends.find((f) => f.friend.id === "a")!;
    // WMI round trip = 40 + 60 = 100 beats WAW = 150 + 20 = 170; a mixed WMI→WAW (60) is not allowed.
    expect(a.outbound!.id).toBe("a-wmi");
    expect(a.inbound!.id).toBe("a-back-wmi");
    expect(a.price).toBe(100);
  });

  it("treats a friend as host when any of their airports is the destination", () => {
    const { plans } = planMeetup({ ...r, friends: [{ id: "a", name: "Ann", origins: ["BCN", "WMI"] }, r.friends[1]] }, "BCN", sets);
    expect(plans[0].friends.find((f) => f.friend.id === "a")!.outbound).toBeNull();
  });
});

describe("friend schema", () => {
  it("accepts the legacy single origin and dedupes airports", async () => {
    const { friendSchema } = await import("@/lib/api/schemas");
    expect(friendSchema.parse({ id: "x", name: "X", origin: "KRK" }).origins).toEqual(["KRK"]);
    expect(friendSchema.parse({ id: "x", name: "X", origins: ["KRK", "KTW", "KRK"] }).origins).toEqual(["KRK", "KTW"]);
    expect(friendSchema.safeParse({ id: "x", name: "X", origins: [] }).success).toBe(false);
  });
});

import { mergeStatus, planMeetupAsync } from "@/lib/meetup/engine";
import type { ProviderStatus } from "@/lib/domain/types";

describe("meetup robustness", () => {
  const st = (status: ProviderStatus["status"], count = 0, error?: string): ProviderStatus => ({ id: "kiwi", name: "Kiwi", kind: "aggregator", status, count, ms: 5, error });
  it("keeps an error even when later requests succeed", () => {
    const m = new Map<string, ProviderStatus>();
    mergeStatus(m, st("error", 0, "timeout"));
    mergeStatus(m, st("ok", 7));
    expect(m.get("kiwi")).toMatchObject({ status: "error", count: 7, error: "timeout" });
  });
  it("async planner returns the same plans as the sync one", async () => {
    const sets: CandidateSets = {
      outbound: new Map([
        ["a", [oneWay("a1", "WAW", "BCN", "2026-11-21T06:00:00.000Z", 180, 100)]],
        ["b", [oneWay("b1", "BER", "BCN", "2026-11-21T07:00:00.000Z", 150, 90)]],
      ]),
      inbound: new Map([
        ["a", [oneWay("a3", "BCN", "WAW", "2026-11-22T18:00:00.000Z", 180, 80)]],
        ["b", [oneWay("b2", "BCN", "BER", "2026-11-22T19:00:00.000Z", 150, 70)]],
      ]),
    };
    const r = { ...req, friends: req.friends.slice(0, 2) };
    expect(await planMeetupAsync(r, "BCN", sets)).toEqual(planMeetup(r, "BCN", sets));
  });
});
