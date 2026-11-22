import { describe, expect, it } from "vitest";
import { airportPairs, expandAirport } from "@/lib/data/nearby";

describe("nearby airports", () => {
  it("keeps the single airport without a spread", () => {
    expect(expandAirport("WAW", 0)).toEqual(["WAW"]);
  });
  it("adds nearby airports by distance, the chosen one first", () => {
    const r = expandAirport("WAW", 100);
    expect(r[0]).toBe("WAW");
    expect(r).toContain("WMI");
    expect(r.length).toBeLessThanOrEqual(3);
  });
  it("country spread stays in the country", () => {
    const r = expandAirport("WAW", "country");
    expect(r.length).toBe(3);
  });
  it("caps pairs and starts with the chosen pair", () => {
    const p = airportPairs("WAW", "BCN", "country", "country");
    expect(p[0]).toEqual(["WAW", "BCN"]);
    expect(p.length).toBeLessThanOrEqual(8);
    expect(p.every(([o, d]) => o !== d)).toBe(true);
  });
});
