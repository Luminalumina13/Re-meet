import { describe, expect, it } from "vitest";
import { findLayoverMeets } from "@/lib/meetup/layover";
import type { FriendPlan } from "@/lib/meetup/types";

const seg = (from: string, to: string, dep: string, arr: string) => ({ from, to, departUtc: dep, arriveUtc: arr });
const trip = (segments: ReturnType<typeof seg>[]) => ({ legs: [{ segments }] }) as never;
const friend = (id: string, outbound: unknown): FriendPlan => ({ friend: { id, name: id, origins: [] }, outbound: outbound as never, inbound: null, arriveUtc: null, departUtc: null, price: 0 });

describe("findLayoverMeets", () => {
  it("finds a shared connection with overlapping waits", () => {
    const a = friend("a", trip([seg("KBP", "VIE", "2026-12-05T06:00Z", "2026-12-05T08:00Z"), seg("VIE", "BCN", "2026-12-05T11:00Z", "2026-12-05T13:00Z")]));
    const b = friend("b", trip([seg("LHR", "VIE", "2026-12-05T07:00Z", "2026-12-05T09:30Z"), seg("VIE", "BCN", "2026-12-05T12:00Z", "2026-12-05T14:00Z")]));
    const r = findLayoverMeets([a, b]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ airport: "VIE", minutes: 90, direction: "outbound" });
  });
  it("ignores short or non-overlapping waits and different airports", () => {
    const a = friend("a", trip([seg("X", "VIE", "2026-12-05T06:00Z", "2026-12-05T08:00Z"), seg("VIE", "Y", "2026-12-05T09:00Z", "2026-12-05T11:00Z")]));
    const b = friend("b", trip([seg("X", "FRA", "2026-12-05T06:00Z", "2026-12-05T08:00Z"), seg("FRA", "Y", "2026-12-05T11:00Z", "2026-12-05T13:00Z")]));
    expect(findLayoverMeets([a, b])).toEqual([]);
  });
});

import { findSharedFlights } from "@/lib/meetup/layover";

describe("findSharedFlights", () => {
  it("finds a flight two friends both take", () => {
    const s = (from: string, to: string, dep: string, n: string) => ({ from, to, departUtc: dep, arriveUtc: dep, carrier: "LO", flightNumber: n });
    const a = friend("a", { legs: [{ segments: [s("KBP", "WAW", "2026-12-05T06:00Z", "100"), s("WAW", "BCN", "2026-12-05T10:00Z", "333")] }] });
    const b = friend("b", { legs: [{ segments: [s("WAW", "BCN", "2026-12-05T10:00Z", "333")] }] });
    expect(findSharedFlights([a, b])).toEqual([{ flight: "LO333", from: "WAW", to: "BCN", friendIds: ["a", "b"], direction: "outbound" }]);
  });
});
