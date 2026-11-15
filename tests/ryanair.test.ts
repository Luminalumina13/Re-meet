import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RyanairProvider, clearRyanairCache, type FarfndFare, type FarfndResponse } from "@/lib/providers/ryanair";
import { hhmmToMinutes } from "@/lib/domain/time";

const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures/ryanair-oneway-krk-bcn.json"), "utf8")) as FarfndResponse;

/** A fake fare-finder that behaves like the real one: cheapest flight inside the time window. */
function fakeApi(schedule: Record<string, { time: string; arrive: string; price: number; no: string }[]>) {
  const calls: string[] = [];
  const request = async (url: string) => {
    calls.push(url);
    const q = new URL(url).searchParams;
    const key = `${q.get("departureAirportIataCode")}-${q.get("arrivalAirportIataCode")}-${q.get("outboundDepartureDateFrom")}`;
    const date = q.get("outboundDepartureDateFrom")!;
    const a = hhmmToMinutes(q.get("outboundDepartureTimeFrom")!);
    const b = hhmmToMinutes(q.get("outboundDepartureTimeTo")!);
    const [from, to] = key.split("-");
    const inWindow = (schedule[key] ?? []).filter((f) => hhmmToMinutes(f.time) >= a && hhmmToMinutes(f.time) <= b);
    inWindow.sort((x, y) => x.price - y.price);
    const fares: FarfndFare[] = inWindow.slice(0, 1).map((f) => ({
      outbound: {
        departureAirport: { iataCode: from, name: from },
        arrivalAirport: { iataCode: to, name: to },
        departureDate: `${date}T${f.time}:00`,
        arrivalDate: `${date}T${f.arrive}:00`,
        price: { value: f.price, currencyCode: "EUR" },
        flightKey: `FR~${f.no}~${date}T${f.time}`,
        flightNumber: `FR${f.no}`,
      },
    }));
    return { status: 200, body: { fares, size: fares.length } };
  };
  return { request, calls };
}

const base = { adults: 1, cabin: "economy" as const, currency: "EUR" };

describe("Ryanair connector", () => {
  beforeEach(() => clearRyanairCache());

  it("maps a real fare-finder response", () => {
    const leg = new RyanairProvider({ request: async () => ({ status: 200, body: fixture }) }).toLeg(fixture.fares[0]);
    expect(leg.from).toBe("KRK");
    expect(leg.to).toBe("BCN");
    expect(leg.departLocal).toBe("2026-11-21T09:15");
    // Kraków and Barcelona share CET in November: 09:15 local = 08:15 UTC.
    expect(leg.departUtc).toBe("2026-11-21T08:15:00.000Z");
    expect(leg.durationMin).toBe(170);
    expect(leg.segments[0]).toMatchObject({ carrier: "FR", flightNumber: "3050", carrierName: "Ryanair" });
  });

  it("finds every flight of the day by splitting time windows", async () => {
    const day = [
      { time: "06:35", arrive: "07:55", price: 75.99, no: "205" },
      { time: "08:15", arrive: "09:35", price: 88.99, no: "293" },
      { time: "11:40", arrive: "13:00", price: 52.0, no: "201" },
      { time: "15:30", arrive: "16:50", price: 46.32, no: "256" },
      { time: "19:15", arrive: "20:35", price: 35.99, no: "289" },
    ];
    const api = fakeApi({ "STN-DUB-2026-11-21": day });
    const p = new RyanairProvider({ request: api.request });
    const list = await p.search({ ...base, origin: "STN", destination: "DUB", departDate: "2026-11-21" });
    expect(list.map((i) => i.legs[0].departLocal.slice(11))).toEqual(day.map((d) => d.time));
    expect(list.find((i) => i.legs[0].segments[0].flightNumber === "256")!.price.amount).toBe(46.32);
    // About 2n+1 requests for n flights.
    expect(api.calls.length).toBe(2 * day.length + 1);
    // Second search is served from the day cache.
    await p.search({ ...base, origin: "STN", destination: "DUB", departDate: "2026-11-21" });
    expect(api.calls.length).toBe(2 * day.length + 1);
  });

  it("builds round trips, multiplies by passengers, skips other cabins", async () => {
    const api = fakeApi({
      "KRK-BCN-2026-11-21": [{ time: "09:15", arrive: "12:05", price: 151.99, no: "3050" }],
      "BCN-KRK-2026-11-22": [
        { time: "12:45", arrive: "15:35", price: 40, no: "3051" },
        { time: "18:30", arrive: "21:20", price: 60, no: "3053" },
      ],
    });
    const p = new RyanairProvider({ request: api.request });
    const rt = await p.search({ ...base, adults: 2, origin: "KRK", destination: "BCN", departDate: "2026-11-21", returnDate: "2026-11-22" });
    expect(rt).toHaveLength(2);
    expect(rt.map((i) => i.price.amount).sort()).toEqual([383.98, 423.98]);
    expect(rt[0].deepLink).toContain("isReturn=true");
    expect(await p.search({ ...base, cabin: "business", origin: "KRK", destination: "BCN", departDate: "2026-11-21" })).toEqual([]);
  });

  it("returns nothing for routes Ryanair does not fly and reports HTTP errors", async () => {
    const p = new RyanairProvider({ request: fakeApi({}).request });
    expect(await p.search({ ...base, origin: "KBP", destination: "BCN", departDate: "2026-11-21" })).toEqual([]);
    const broken = new RyanairProvider({ request: async () => ({ status: 503, body: { fares: [], size: 0 } }) });
    await expect(broken.search({ ...base, origin: "KRK", destination: "BCN", departDate: "2026-11-21" })).rejects.toThrow(/503/);
  });
});
