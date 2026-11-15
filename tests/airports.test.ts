import { describe, expect, it } from "vitest";
import { AIRPORTS, searchAirports } from "@/lib/data/airports";
import { CITY_UK } from "@/lib/data/airportsUk";

const top = (q: string) => searchAirports(q, 5).map((a) => a.iata);

describe("airport search", () => {
  it("understands Ukrainian city names", () => {
    expect(top("варш")).toContain("WAW");
    expect(top("Барселона")).toEqual(["BCN"]);
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

  it("has a Ukrainian name for every city in the table", () => {
    const missing = [...new Set(AIRPORTS.map((a) => a.city))].filter((c) => !CITY_UK[c]);
    expect(missing).toEqual([]);
  });
});

describe("leisure destinations", () => {
  it("finds Funchal and other islands in both languages", () => {
    expect(top("фуншал")).toEqual(["FNC"]);
    expect(top("funchal")).toEqual(["FNC"]);
    expect(top("fnc")[0]).toBe("FNC");
    expect(top("тенеріфе")).toEqual(["TFS"]);
    expect(top("санторіні")).toEqual(["JTR"]);
    expect(top("хургада")).toEqual(["HRG"]);
    expect(searchAirports("мадейра", 5).map((a) => a.iata)).toEqual(["FNC"]);
  });

  it("has no duplicate airport codes", () => {
    const codes = AIRPORTS.map((a) => a.iata);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
