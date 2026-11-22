import { describe, expect, it } from "vitest";
import { buildExploreQuery, buildMeetupQuery, buildSearchQuery, parseExploreQuery, parseMeetupQuery, parseSearchQuery } from "@/lib/share";

const q = (s: string) => new URLSearchParams(s);

describe("search links", () => {
  it("round-trips a weekend search", () => {
    const state = { mode: "weekend" as const, origin: "WAW", destination: "ACE", saturday: "2026-11-28", shape: "fri-sun" as const, adults: 2, children: 1, infants: 1, cabin: "business" as const };
    const parsed = parseSearchQuery(q(buildSearchQuery(state)));
    expect(parsed).toMatchObject({ origin: "WAW", destination: "ACE", mode: "weekend", saturday: "2026-11-28", shape: "fri-sun", adults: 2, children: 1, infants: 1, cabin: "business" });
  });

  it("round-trips custom dates, one way and return", () => {
    const ret = parseSearchQuery(q(buildSearchQuery({ mode: "custom", origin: "WAW", destination: "BCN", departDate: "2026-12-02", returnDate: "2026-12-06" })));
    expect(ret).toMatchObject({ mode: "custom", departDate: "2026-12-02", returnDate: "2026-12-06" });
    const one = parseSearchQuery(q(buildSearchQuery({ mode: "custom", origin: "WAW", destination: "BCN", departDate: "2026-12-02" })));
    expect(one).toMatchObject({ mode: "custom", departDate: "2026-12-02", returnDate: undefined });
  });

  it("keeps links short: defaults are left out", () => {
    expect(buildSearchQuery({ mode: "weekend", origin: "WAW", destination: "BCN", saturday: "2026-11-28", shape: "sat-sun", adults: 1, children: 0, infants: 0, cabin: "economy" })).toBe("from=WAW&to=BCN&sat=2026-11-28");
  });

  it("still understands the old destination-card links", () => {
    expect(parseSearchQuery(q("from=waw&to=bcn&sat=2026-11-28&shape=sat-sun"))).toMatchObject({ origin: "WAW", destination: "BCN", mode: "weekend", saturday: "2026-11-28" });
  });

  it("ignores garbage and enforces passenger rules", () => {
    const bad = parseSearchQuery(q("from=WARSAW&to=%3Cscript%3E&sat=tomorrow&shape=weird&cabin=yacht&a=99&c=-1&i=x"));
    expect(bad).toMatchObject({ origin: undefined, destination: undefined, saturday: undefined, shape: undefined, cabin: undefined, adults: undefined, children: undefined, infants: undefined });
    // more infants than adults is clamped; a party over nine seats drops the extras
    expect(parseSearchQuery(q("a=1&i=3")).infants).toBe(1);
    const big = parseSearchQuery(q("a=5&c=4&i=1"));
    expect(big.adults).toBe(5);
    expect(big.children).toBeUndefined();
  });
});

describe("explore links", () => {
  it("round-trips custom dates and needs both of them", () => {
    const state = { origin: "WAW", mode: "custom" as const, departDate: "2026-12-02", returnDate: "2026-12-09", maxHours: 5 };
    expect(parseExploreQuery(q(buildExploreQuery(state)))).toMatchObject(state);
    // a link with only a departure, or a return before it, falls back to the weekend form
    expect(parseExploreQuery(q("from=WAW&dep=2026-12-02")).mode).toBeUndefined();
    expect(parseExploreQuery(q("from=WAW&dep=2026-12-09&ret=2026-12-02")).mode).toBeUndefined();
    expect(buildExploreQuery({ origin: "WAW", mode: "weekend", saturday: "2026-12-05", departDate: "2026-12-02", returnDate: "2026-12-09" })).toBe("from=WAW&sat=2026-12-05");
  });

  it("round-trips and validates", () => {
    const state = { origin: "KRK", saturday: "2026-12-05", shape: "fri-mon" as const, maxHours: 6, directOnly: true, budget: "250", adults: 2 };
    expect(parseExploreQuery(q(buildExploreQuery(state)))).toMatchObject(state);
    expect(parseExploreQuery(q("h=99&budget=abc&direct=yes"))).toMatchObject({ maxHours: undefined, budget: undefined, directOnly: undefined });
  });
});

describe("meetup links", () => {
  it("round-trips friends with several airports, places and dates", () => {
    const state = {
      friends: [{ name: "Світлана", origins: ["KRK", "KTW"] }, { name: "Андрій", origins: ["BER"] }],
      destinations: ["FNC", "BCN"],
      mode: "custom" as const,
      departDate: "2026-12-02",
      returnDate: "2026-12-06",
      valuePerHour: 40,
      budget: "300",
      includeOrigins: true,
    };
    const parsed = parseMeetupQuery(q(buildMeetupQuery(state)));
    expect(parsed).toMatchObject(state);
  });

  it("survives names with separators and drops unusable friends", () => {
    const url = buildMeetupQuery({ friends: [{ name: "A~B,C", origins: ["WAW"] }, { name: "Bo", origins: ["BER"] }, { name: "", origins: ["LIS"] }, { name: "NoAirport", origins: [""] }], destinations: ["BCN"], mode: "weekend", saturday: "2026-11-28" });
    const parsed = parseMeetupQuery(q(url));
    expect(parsed.friends).toEqual([{ name: "A B C", origins: ["WAW"] }, { name: "Bo", origins: ["BER"] }]);
  });

  it("needs two friends and ignores bad airports", () => {
    expect(parseMeetupQuery(q("f=Ann~WAW")).friends).toBeUndefined();
    expect(parseMeetupQuery(q("f=Ann~WAW,Bo~NOPE&to=BCN")).friends).toBeUndefined();
    expect(parseMeetupQuery(q("f=Ann~WAW,Bo~BER.XX.LIS&to=bcn,zzzz")).friends?.[1].origins).toEqual(["BER", "LIS"]);
    expect(parseMeetupQuery(q("f=Ann~WAW,Bo~BER&to=bcn,zzzz")).destinations).toEqual(["BCN"]);
  });
});

describe("complex route and nearby links", () => {
  it("round-trips a multi-leg trip", () => {
    const legs = [{ from: "FCO", to: "WAW", date: "2026-12-04" }, { from: "WAW", to: "KRK", date: "2026-12-06" }];
    const parsed = parseSearchQuery(q(buildSearchQuery({ mode: "multi", origin: "WAW", destination: "NAP", departDate: "2026-12-01", legs })));
    expect(parsed).toMatchObject({ mode: "multi", origin: "WAW", destination: "NAP", departDate: "2026-12-01", legs });
  });
  it("drops a multi-leg link with a broken leg", () => {
    expect(parseSearchQuery(q("from=WAW&to=NAP&dep=2026-12-01&leg=FCO.WAW.nope")).legs).toBeUndefined();
  });
  it("round-trips nearby airport spreads and ignores bad ones", () => {
    const p = parseSearchQuery(q(buildSearchQuery({ mode: "weekend", origin: "WAW", destination: "BCN", saturday: "2026-11-28", oSpread: 200, dSpread: "country" })));
    expect(p).toMatchObject({ oSpread: 200, dSpread: "country" });
    expect(parseSearchQuery(q("from=WAW&to=BCN&os=999&ds=x"))).toMatchObject({ oSpread: undefined, dSpread: undefined });
  });
});
