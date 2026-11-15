import { describe, expect, it } from "vitest";
import { KiwiProvider } from "@/lib/providers/kiwi";
import { AmadeusProvider } from "@/lib/providers/amadeus";
import { DuffelProvider } from "@/lib/providers/duffel";
import { dedupe } from "@/lib/providers/aggregator";
import { isoDurationToMinutes } from "@/lib/providers/util";

describe("vendor mappers", () => {
  it("kiwi", () => {
    const it = new KiwiProvider().map(
      {
        id: "k1",
        price: 120,
        deep_link: "https://kiwi.com/x",
        availability: { seats: 3 },
        route: [
          { id: "r1", flyFrom: "WAW", flyTo: "BCN", airline: "FR", flight_no: 1234, local_departure: "2026-11-21T08:40:00.000Z", local_arrival: "2026-11-21T11:45:00.000Z", utc_departure: "2026-11-21T07:40:00.000Z", utc_arrival: "2026-11-21T10:45:00.000Z", return: 0 },
          { id: "r2", flyFrom: "BCN", flyTo: "WAW", airline: "FR", flight_no: 1235, local_departure: "2026-11-22T17:00:00.000Z", local_arrival: "2026-11-22T20:00:00.000Z", utc_departure: "2026-11-22T16:00:00.000Z", utc_arrival: "2026-11-22T19:00:00.000Z", return: 1 },
        ],
      },
      "EUR",
    );
    expect(it.legs).toHaveLength(2);
    expect(it.legs[0].departLocal).toBe("2026-11-21T08:40");
    expect(it.legs[0].durationMin).toBe(185);
    expect(it.legs[1].arriveLocal).toBe("2026-11-22T20:00");
    expect(it.seatsLeft).toBe(3);
    expect(it.signature).toContain("FR1234@2026-11-21T07:40");
  });

  it("amadeus derives UTC from airport zones", () => {
    const it = new AmadeusProvider().map(
      {
        id: "1",
        numberOfBookableSeats: 4,
        price: { grandTotal: "99.50", currency: "EUR" },
        itineraries: [
          {
            duration: "PT3H5M",
            segments: [{ departure: { iataCode: "WAW", at: "2026-11-21T08:40:00" }, arrival: { iataCode: "BCN", at: "2026-11-21T11:45:00" }, carrierCode: "LO", number: "437", duration: "PT3H5M" }],
          },
        ],
      },
      { LO: "LOT" },
    );
    expect(it.legs[0].departUtc).toBe("2026-11-21T07:40:00.000Z");
    expect(it.legs[0].arriveUtc).toBe("2026-11-21T10:45:00.000Z");
    expect(it.legs[0].segments[0].carrierName).toBe("LOT");
    expect(it.price.amount).toBe(99.5);
  });

  it("duffel", () => {
    const it = new DuffelProvider().map({
      id: "off_1",
      total_amount: "150.00",
      total_currency: "EUR",
      owner: { name: "Vueling" },
      slices: [
        {
          segments: [
            { origin: { iata_code: "BER" }, destination: { iata_code: "BCN" }, departing_at: "2026-11-21T09:00:00", arriving_at: "2026-11-21T11:30:00", marketing_carrier: { iata_code: "VY", name: "Vueling" }, marketing_carrier_flight_number: "1880", duration: "PT2H30M" },
          ],
        },
      ],
    });
    expect(it.legs[0].durationMin).toBe(150);
    expect(it.legs[0].departUtc).toBe("2026-11-21T08:00:00.000Z");
    expect(it.providerName).toContain("Vueling");
  });

  it("dedupe keeps the cheapest copy of the same flights", () => {
    const k = new KiwiProvider();
    const mk = (id: string, price: number) =>
      k.map({ id, price, deep_link: "", route: [{ id: "r", flyFrom: "WAW", flyTo: "BCN", airline: "FR", flight_no: 1, local_departure: "2026-11-21T08:00:00.000Z", local_arrival: "2026-11-21T11:00:00.000Z", utc_departure: "2026-11-21T07:00:00.000Z", utc_arrival: "2026-11-21T10:00:00.000Z", return: 0 }] }, "EUR");
    const out = dedupe([mk("a", 100), mk("b", 80), mk("c", 120)]);
    expect(out).toHaveLength(1);
    expect(out[0].price.amount).toBe(80);
  });

  it("iso durations", () => {
    expect(isoDurationToMinutes("PT2H35M")).toBe(155);
    expect(isoDurationToMinutes("PT45M")).toBe(45);
    expect(isoDurationToMinutes("P1DT1H")).toBe(1500);
  });
});
