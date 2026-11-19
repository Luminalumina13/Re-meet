import { describe, expect, it } from "vitest";
import { neededDays, rankTrips, weekendTrips } from "@/lib/flex/weekends";

const opt = (price: number, depart: string, arrive: string) => ({ price, departUtc: depart, arriveUtc: arrive });

describe("weekendTrips", () => {
  // 2026-11-19 is a Thursday; the next Saturday is 21 November.
  it("gives the next weekends for every chosen shape", () => {
    const t = weekendTrips("2026-11-19", 3, ["sat-sun", "fri-mon"]);
    expect(t).toHaveLength(6);
    expect(t.map((x) => x.saturday)).toEqual(["2026-11-21", "2026-11-21", "2026-11-28", "2026-11-28", "2026-12-05", "2026-12-05"]);
    expect(t.find((x) => x.shape === "fri-mon")).toMatchObject({ departDate: "2026-11-20", returnDate: "2026-11-23" });
  });

  it("drops a trip that would leave today or earlier", () => {
    // 2026-11-20 is a Friday: fri-sun for this weekend departs today, so it is skipped.
    const t = weekendTrips("2026-11-20", 2, ["fri-sun"]);
    expect(t.every((x) => x.departDate > "2026-11-20")).toBe(true);
    expect(t).toHaveLength(2);
    expect(t[0].departDate).toBe("2026-11-27");
  });
});

describe("neededDays", () => {
  it("lists each day once", () => {
    const t = weekendTrips("2026-11-19", 1, ["sat-sun", "fri-sun", "sat-mon", "fri-mon"]);
    expect(neededDays(t)).toEqual({ out: ["2026-11-20", "2026-11-21"], back: ["2026-11-22", "2026-11-23"] });
  });
});

describe("rankTrips", () => {
  it("orders by price and skips trips without a feasible pair", () => {
    const trips = weekendTrips("2026-11-19", 1, ["sat-sun", "fri-sun", "sat-mon"]);
    const out = new Map([
      ["2026-11-20", [opt(30, "2026-11-20T10:00:00Z", "2026-11-20T12:00:00Z")]],
      ["2026-11-21", [opt(50, "2026-11-21T10:00:00Z", "2026-11-21T12:00:00Z")]],
    ]);
    const back = new Map([
      ["2026-11-22", [opt(40, "2026-11-22T15:00:00Z", "2026-11-22T17:00:00Z")]],
      ["2026-11-23", [] as ReturnType<typeof opt>[]], // nothing on Monday
    ]);
    const ranked = rankTrips(trips, out, back);
    expect(ranked.map((r) => [r.shape, r.price])).toEqual([["fri-sun", 70], ["sat-sun", 90]]);
  });
});
