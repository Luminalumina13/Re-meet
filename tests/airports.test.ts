import { describe, expect, it } from "vitest";
import { AIRPORTS, getAirport, isMajor, searchAirports } from "@/lib/data/airports";
import { CITY_UK } from "@/lib/data/airportsUk";

const top = (q: string) => searchAirports(q, 5).map((a) => a.iata);

describe("airport search", () => {
  it("understands Ukrainian city names", () => {
    expect(top("варш")).toContain("WAW");
    expect(top("Барселона")[0]).toBe("BCN");
    expect(top("лон")).toEqual(expect.arrayContaining(["LHR", "STN"]));
    expect(top("скоп’є")).toEqual(["SKP"]);
  });

  it("finds Paphos by Ukrainian and English name", () => {
    expect(top("пафос")).toEqual(["PFO"]);
    expect(top("paphos")).toEqual(["PFO"]);
    expect(top("pfo")[0]).toBe("PFO");
  });

  it("understands Ukrainian country names", () => {
    expect(searchAirports("польща", 20).map((a) => a.iata)).toEqual(expect.arrayContaining(["WAW", "KRK"]));
  });

  it("ignores diacritics in Latin queries", () => {
    expect(top("krakow")).toContain("KRK");
    expect(top("zurich")).toContain("ZRH");
    expect(top("wroclaw")).toContain("WRO");
  });

  it("still matches codes and English names", () => {
    expect(top("waw")[0]).toBe("WAW");
    expect(top("barcel")).toContain("BCN");
  });

  it("has a Ukrainian name for every city in the curated list", () => {
    const missing = [...new Set(AIRPORTS.filter((a) => a.size === undefined).map((a) => a.city))].filter((c) => !CITY_UK[c]);
    expect(missing).toEqual([]);
  });

  it("knows thousands of airports with unique codes and sane data", () => {
    expect(AIRPORTS.length).toBeGreaterThan(3000);
    expect(new Set(AIRPORTS.map((a) => a.iata)).size).toBe(AIRPORTS.length);
    for (const a of AIRPORTS) {
      expect(a.iata).toMatch(/^[A-Z]{3}$/);
      expect(Math.abs(a.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(a.lon)).toBeLessThanOrEqual(180);
      expect(a.tz).toContain("/");
    }
  });

  it("offers both Tenerife airports", () => {
    expect(top("tenerife")).toEqual(expect.arrayContaining(["TFS", "TFN"]));
    expect(top("тенеріфе")).toEqual(expect.arrayContaining(["TFS", "TFN"]));
    expect(getAirport("TFN")?.city).toBe(getAirport("TFS")?.city);
  });

  it("keeps big, familiar airports first and finds small ones too", () => {
    expect(top("lon")[0]).toBe("LHR");
    expect(top("paris")).toContain("CDG");
    expect(top("sao paulo")).toContain("GRU");
    expect(top("tokyo")).toEqual(expect.arrayContaining(["HND", "NRT"]));
    expect(isMajor(getAirport("WAW")!)).toBe(true);
  });
});

describe("leisure destinations", () => {
  it("finds Funchal and other islands in both languages", () => {
    expect(top("фуншал")).toEqual(["FNC"]);
    expect(top("funchal")).toEqual(["FNC"]);
    expect(top("fnc")[0]).toBe("FNC");
    expect(top("тенеріфе")).toEqual(["TFS", "TFN"]);
    expect(top("санторіні")).toEqual(["JTR"]);
    expect(top("хургада")).toEqual(["HRG"]);
    expect(searchAirports("мадейра", 5).map((a) => a.iata)).toEqual(["FNC"]);
  });

  it("has no duplicate airport codes", () => {
    const codes = AIRPORTS.map((a) => a.iata);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
