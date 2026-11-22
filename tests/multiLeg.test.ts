import { describe, expect, it } from "vitest";
import { bestChains } from "@/lib/multiLeg";
import type { Itinerary } from "@/lib/domain/types";

const mk = (sig: string, price: number, dep: string, arr: string) => ({ signature: sig, price: { amount: price, currency: "EUR" }, legs: [{ departUtc: dep, arriveUtc: arr }] }) as unknown as Itinerary;

describe("bestChains", () => {
  const l1 = [mk("a1", 50, "2026-12-05T08:00Z", "2026-12-05T10:00Z"), mk("a2", 80, "2026-12-05T09:00Z", "2026-12-05T11:00Z")];
  const l2 = [mk("b1", 30, "2026-12-05T11:00Z", "2026-12-05T13:00Z"), mk("b2", 60, "2026-12-06T09:00Z", "2026-12-06T11:00Z")];
  const l3 = [mk("c1", 40, "2026-12-08T09:00Z", "2026-12-08T11:00Z")];
  it("chains three legs respecting the minimum gap", () => {
    const r = bestChains([l1, l2, l3]);
    // b1 leaves only 1h after a1 lands, so it is not catchable: the cheapest chain uses b2
    expect(r[0].flights.map((f) => f.signature)).toEqual(["a1", "b2", "c1"]);
    expect(r[0].total).toBe(150);
  });
  it("returns nothing when a leg has no flights", () => {
    expect(bestChains([l1, []])).toEqual([]);
  });
});
