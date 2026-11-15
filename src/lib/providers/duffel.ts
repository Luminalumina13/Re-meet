import type { Itinerary, SearchRequest, Segment } from "@/lib/domain/types";
import { airportTz } from "@/lib/data/airports";
import { localToUtc } from "@/lib/domain/time";
import type { FlightProvider } from "./types";
import { ProviderError } from "./types";
import { finalize, httpJson, isoDurationToMinutes, legFromSegments } from "./util";

/**
 * Duffel Flights API connector. https://duffel.com/docs/api/offer-requests/create-offer-request
 * Env: DUFFEL_ACCESS_TOKEN
 */

interface DuffelSegment {
  origin: { iata_code: string };
  destination: { iata_code: string };
  departing_at: string;
  arriving_at: string;
  marketing_carrier: { iata_code: string; name: string };
  marketing_carrier_flight_number: string;
  duration: string | null;
}

interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { name: string };
  slices: { segments: DuffelSegment[] }[];
}

interface DuffelResponse {
  data: { id: string; offers: DuffelOffer[] };
  errors?: { message?: string; title?: string }[];
}

export class DuffelProvider implements FlightProvider {
  readonly id = "duffel";
  readonly name = "Duffel";
  private readonly token = process.env.DUFFEL_ACCESS_TOKEN ?? "";
  private readonly baseUrl = "https://api.duffel.com";

  isConfigured(): boolean {
    return this.token.length > 0;
  }

  async search(req: SearchRequest, signal?: AbortSignal): Promise<Itinerary[]> {
    const slices = [{ origin: req.origin, destination: req.destination, departure_date: req.departDate }];
    if (req.returnDate) {
      slices.push({ origin: req.destination, destination: req.origin, departure_date: req.returnDate });
    }
    const { status, body } = await httpJson<DuffelResponse>(`${this.baseUrl}/air/offer_requests?return_offers=true`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "Duffel-Version": "v2",
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          slices,
          passengers: Array.from({ length: req.adults }, () => ({ type: "adult" })),
          cabin_class: req.cabin,
          max_connections: req.filters?.maxStops ?? 1,
        },
      }),
      signal,
      timeoutMs: 30000,
    });
    if (status !== 200 && status !== 201) {
      throw new ProviderError(this.id, body?.errors?.[0]?.message ?? `HTTP ${status}`, status);
    }
    return body.data.offers.map((o) => this.map(o));
  }

  map(o: DuffelOffer): Itinerary {
    const legs = o.slices.map((sl) =>
      legFromSegments(
        sl.segments.map((s): Segment => {
          // Duffel returns local times with no offset; derive UTC from airport zones.
          const departLocal = s.departing_at.slice(0, 16);
          const arriveLocal = s.arriving_at.slice(0, 16);
          const departUtc = localToUtc(departLocal, airportTz(s.origin.iata_code));
          const arriveUtc = localToUtc(arriveLocal, airportTz(s.destination.iata_code));
          return {
            from: s.origin.iata_code,
            to: s.destination.iata_code,
            departLocal,
            arriveLocal,
            departUtc,
            arriveUtc,
            carrier: s.marketing_carrier.iata_code,
            carrierName: s.marketing_carrier.name,
            flightNumber: s.marketing_carrier_flight_number,
            durationMin: s.duration
              ? isoDurationToMinutes(s.duration)
              : Math.round((Date.parse(arriveUtc) - Date.parse(departUtc)) / 60000),
          };
        }),
      ),
    );
    return finalize({
      id: `duffel-${o.id}`,
      provider: this.id,
      providerName: `${this.name} · ${o.owner.name}`,
      legs,
      price: { amount: Number(o.total_amount), currency: o.total_currency },
    });
  }
}
