import { beforeEach, describe, expect, it } from "vitest";
import { datePairs, isRange, moveWith, nightsWindow, pairFits, rangeDays, rangeProblem } from "@/lib/domain/dateRange";
import { defaultRangeForm, parseRangeQuery, rangeFormToRequest, rangeQuery } from "@/lib/rangeForm";
import { buildExploreQuery, buildMeetupQuery, buildSearchQuery, parseExploreQuery, parseMeetupQuery, parseSearchQuery } from "@/lib/share";
import { exploreRequestSchema, meetupRequestSchema } from "@/lib/api/schemas";
import { searchedDays } from "@/lib/api/guard";
import { meetup } from "@/lib/meetup/engine";
import { meetVia } from "@/lib/meetup/via";
import { explore } from "@/lib/explore/engine";
import { MockProvider } from "@/lib/providers/mock";
import { KiwiMcpProvider, clearKiwiMcpCache } from "@/lib/providers/kiwiMcp";
import type { MeetupRequest } from "@/lib/meetup/types";
import type { ExploreRequest } from "@/lib/explore/types";

describe("date ranges", () => {
  it("lists the days of a window", () => {
    expect(rangeDays("2026-12-05")).toEqual(["2026-12-05"]);
    expect(rangeDays("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });

  it("pairs a departure window with a return window", () => {
    const pairs = datePairs({ departDate: "2026-12-05", departUntil: "2026-12-06", returnDate: "2026-12-06", returnUntil: "2026-12-07" });
    expect(pairs).toEqual([
      ["2026-12-05", "2026-12-06"],
      ["2026-12-05", "2026-12-07"],
      ["2026-12-06", "2026-12-06"],
      ["2026-12-06", "2026-12-07"],
    ]);
  });

  it("limits the pairs by nights", () => {
    const r = { departDate: "2026-12-05", departUntil: "2026-12-07", ...nightsWindow("2026-12-05", "2026-12-07", 2, 3), minNights: 2, maxNights: 3 };
    expect(r.returnDate).toBe("2026-12-07");
    expect(r.returnUntil).toBe("2026-12-10");
    const pairs = datePairs(r);
    expect(pairs).toHaveLength(6);
    for (const [d, ret] of pairs) expect(pairFits(r, d, ret)).toBe(true);
    expect(pairFits(r, "2026-12-05", "2026-12-06")).toBe(false);
  });

  it("a changed departure carries the return along", () => {
    expect(moveWith("2027-01-08", "2027-01-05", "2026-12-12")).toBe("2026-12-15");
    expect(moveWith("2026-12-07", "2026-12-05", "2026-12-20")).toBe("2026-12-22");
    expect(moveWith("", "2026-12-05", "2026-12-20")).toBe("");
  });

  it("an exact trip is not a range", () => {
    expect(isRange({ departDate: "2026-12-05", returnDate: "2026-12-07" })).toBe(false);
    expect(isRange({ departDate: "2026-12-05", departUntil: "2026-12-06", returnDate: "2026-12-07" })).toBe(true);
  });

  it("explains what is wrong with a range", () => {
    expect(rangeProblem({ departDate: "2026-12-05", departUntil: "2026-12-04" }, 7)).toBe("order");
    expect(rangeProblem({ departDate: "2026-12-01", departUntil: "2026-12-20" }, 7)).toBe("tooLong");
    expect(rangeProblem({ departDate: "2026-12-05", departUntil: "2026-12-06", returnDate: "2026-12-01", returnUntil: "2026-12-02" }, 7)).toBe("empty");
    expect(rangeProblem({ departDate: "2026-12-05", departUntil: "2026-12-11", returnDate: "2026-12-07", returnUntil: "2026-12-15", minNights: 2, maxNights: 4 }, 7)).toBeNull();
  });

  it("the API refuses ranges that are too long", () => {
    const base = { friends: [{ id: "a", name: "A", origins: ["WAW"] }, { id: "b", name: "B", origins: ["BER"] }], destinations: ["BCN"], departDate: "2026-12-01", returnDate: "2026-12-03" };
    expect(meetupRequestSchema.safeParse({ ...base, departUntil: "2026-12-07", returnUntil: "2026-12-09" }).success).toBe(true);
    expect(meetupRequestSchema.safeParse({ ...base, departUntil: "2026-12-20", returnUntil: "2026-12-22" }).success).toBe(false);
  });

  it("charges the bot budget per searched day", () => {
    expect(searchedDays({ departDate: "2026-12-05", returnDate: "2026-12-07" })).toBe(2);
    expect(searchedDays({ departDate: "2026-12-05", departUntil: "2026-12-07", returnDate: "2026-12-07", returnUntil: "2026-12-09" })).toBe(6);
  });
});

describe("range form and share links", () => {
  it("turns nights into a return window", () => {
    const f = defaultRangeForm({ from: "2099-01-10", until: "2099-01-12", back: "nights", minNights: 1, maxNights: 2 });
    expect(rangeFormToRequest(f)).toEqual({ departDate: "2099-01-10", departUntil: "2099-01-12", returnDate: "2099-01-11", returnUntil: "2099-01-14", minNights: 1, maxNights: 2 });
    expect(rangeFormToRequest({ ...f, back: "oneway" })).toEqual({ departDate: "2099-01-10", departUntil: "2099-01-12" });
  });

  it("round-trips through a link", () => {
    const f = defaultRangeForm({ from: "2099-01-10", until: "2099-01-12", back: "dates", retFrom: "2099-01-13", retUntil: "2099-01-15" });
    const q = new URLSearchParams();
    rangeQuery(q, f);
    expect(parseRangeQuery(q)).toMatchObject({ from: "2099-01-10", until: "2099-01-12", back: "dates", retFrom: "2099-01-13", retUntil: "2099-01-15" });
  });

  it("search, meet-up and anywhere links keep the range", () => {
    const range = defaultRangeForm({ from: "2099-01-10", until: "2099-01-12", back: "nights", minNights: 2, maxNights: 3 });
    const s = parseSearchQuery(new URLSearchParams(buildSearchQuery({ origin: "WAW", destination: "BCN", mode: "range", range })));
    expect(s.mode).toBe("range");
    expect(s.range).toMatchObject({ from: "2099-01-10", until: "2099-01-12", minNights: 2, maxNights: 3 });
    const m = parseMeetupQuery(new URLSearchParams(buildMeetupQuery({ friends: [{ name: "A", origins: ["WAW"] }, { name: "B", origins: ["BER"] }], destinations: ["BCN"], mode: "range", range })));
    expect(m.mode).toBe("range");
    const e = parseExploreQuery(new URLSearchParams(buildExploreQuery({ origin: "WAW", origins: ["KRK", "WAW", "WMI"], mode: "range", range })));
    expect(e.mode).toBe("range");
    expect(e.origins).toEqual(["KRK", "WMI"]);
  });
});

const meetReq: MeetupRequest = {
  friends: [
    { id: "a", name: "A", origins: ["WAW"] },
    { id: "b", name: "B", origins: ["BER"] },
  ],
  destinations: ["BCN"],
  departDate: "2026-12-04",
  departUntil: "2026-12-05",
  returnDate: "2026-12-06",
  returnUntil: "2026-12-07",
  minNights: 2,
  maxNights: 2,
  cabin: "economy",
  currency: "EUR",
  valuePerHour: 0,
};

describe("meet-up over a date range", () => {
  it("plans each fitting day pair and labels the plans with it", async () => {
    const res = await meetup(meetReq, { providers: [new MockProvider({ volatilitySeed: 5 })], fresh: true });
    expect(res.plans.length).toBeGreaterThan(0);
    const pairs = new Set(res.plans.map((p) => `${p.departDate}|${p.returnDate}`));
    for (const k of pairs) expect(["2026-12-04|2026-12-06", "2026-12-05|2026-12-07"]).toContain(k);
    for (const p of res.plans)
      for (const f of p.friends) {
        expect(f.outbound!.legs[0].departLocal.slice(0, 10)).toBe(p.departDate);
        expect(f.inbound!.legs[0].departLocal.slice(0, 10)).toBe(p.returnDate);
      }
  });

  it("the hub search works over a range too", async () => {
    const res = await meetVia({ ...meetReq, friends: [{ id: "a", name: "A", origins: ["VLC"] }, { id: "b", name: "B", origins: ["LCA"] }], destinations: ["BRI"] }, { providers: [new MockProvider({ volatilitySeed: 5 })], fresh: true });
    for (const p of res.plans) expect(["2026-12-04", "2026-12-05"]).toContain(p.departDate);
  });
});

const exploreReq: ExploreRequest = {
  origin: "WAW",
  departDate: "2026-12-04",
  departUntil: "2026-12-06",
  returnDate: "2026-12-06",
  returnUntil: "2026-12-09",
  minNights: 2,
  maxNights: 3,
  adults: 1,
  cabin: "economy",
  currency: "EUR",
  maxFlightHours: 3,
};

beforeEach(() => clearKiwiMcpCache());

describe("anywhere: several airports and a date range", () => {
  it("passes the range to Kiwi in one call per window", () => {
    const plan = new KiwiMcpProvider({ call: async () => ({ currency: "EUR", resultsCount: 0, itineraries: [] }) }).explorePlan(exploreReq);
    expect(plan[0]).toMatchObject({ departureDate: "04/12/2026", departureDateTo: "06/12/2026", returnDate: "06/12/2026", returnDateTo: "09/12/2026", nights_in_dst_from: 2, nights_in_dst_to: 3 });
  });

  it("keeps only trips inside the range", async () => {
    const res = await explore(exploreReq, { providers: [new MockProvider({ volatilitySeed: 2 })], fresh: true });
    expect(res.destinations.length).toBeGreaterThan(0);
    for (const d of res.destinations) {
      const [out, back] = d.best.legs;
      const nights = (Date.parse(back.departLocal.slice(0, 10)) - Date.parse(out.departLocal.slice(0, 10))) / 86400000;
      expect(nights).toBeGreaterThanOrEqual(2);
      expect(nights).toBeLessThanOrEqual(3);
    }
  });

  it("searches every departure airport and never offers their cities", async () => {
    const res = await explore({ ...exploreReq, departUntil: undefined, returnUntil: undefined, minNights: undefined, maxNights: undefined, returnDate: "2026-12-06", origins: ["KRK"] }, { providers: [new MockProvider({ volatilitySeed: 2 })], fresh: true });
    const froms = new Set(res.destinations.flatMap((d) => [d.best.legs[0].from, d.cheapest.legs[0].from]));
    expect(froms.has("KRK") || froms.has("WAW")).toBe(true);
    expect([...froms].every((f) => f === "KRK" || f === "WAW")).toBe(true);
    expect(res.destinations.map((d) => d.city)).not.toContain("Kraków");
    expect(res.destinations.map((d) => d.city)).not.toContain("Warsaw");
    expect(exploreRequestSchema.safeParse({ ...exploreReq, origins: ["KRK", "GDN", "WRO", "POZ", "KTW"] }).success).toBe(false);
  });
});
