import type { Itinerary, SearchRequest, Segment } from "@/lib/domain/types";
import { airportTz } from "@/lib/data/airports";
import { localToUtc } from "@/lib/domain/time";
import type { FlightProvider } from "./types";
import { ProviderError } from "./types";
import { finalize, httpJson, isoDurationToMinutes, legFromSegments } from "./util";

/**
 * Amadeus Self-Service "Flight Offers Search" connector.
 * https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search
 * Env: AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, AMADEUS_ENV=test|production
 */

interface AmadeusSegment {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
  number: string;
  duration: string;
}

interface AmadeusOffer {
  id: string;
  numberOfBookableSeats?: number;
  price: { grandTotal: string; currency: string };
  itineraries: { duration: string; segments: AmadeusSegment[] }[];
}

interface AmadeusResponse {
  data: AmadeusOffer[];
  dictionaries?: { carriers?: Record<string, string> };
  errors?: { detail?: string; title?: string }[];
}

const CABIN: Record<SearchRequest["cabin"], string> = {
  economy: "ECONOMY",
  premium_economy: "PREMIUM_ECONOMY",
  business: "BUSINESS",
  first: "FIRST",
};

export class AmadeusProvider implements FlightProvider {
  readonly id = "amadeus";
  readonly name = "Amadeus";
  readonly kind = "aggregator" as const;
  private readonly clientId = process.env.AMADEUS_CLIENT_ID ?? "";
  private readonly clientSecret = process.env.AMADEUS_CLIENT_SECRET ?? "";
  private readonly baseUrl =
    process.env.AMADEUS_ENV === "production" ? "https://api.amadeus.com" : "https://test.api.amadeus.com";
  private token: { value: string; expiresAt: number } | null = null;

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private async getToken(signal?: AbortSignal): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    const { status, body } = await httpJson<{ access_token: string; expires_in: number }>(
      `${this.baseUrl}/v1/security/oauth2/token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        signal,
      },
    );
    if (status !== 200) throw new ProviderError(this.id, `auth HTTP ${status}`, status);
    this.token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  async search(req: SearchRequest, signal?: AbortSignal): Promise<Itinerary[]> {
    const token = await this.getToken(signal);
    const q = new URLSearchParams({
      originLocationCode: req.origin,
      destinationLocationCode: req.destination,
      departureDate: req.departDate,
      adults: String(req.adults),
      currencyCode: req.currency,
      travelClass: CABIN[req.cabin],
      max: "100",
    });
    if (req.returnDate) q.set("returnDate", req.returnDate);
    if (req.filters?.maxStops === 0) q.set("nonStop", "true");
    const { status, body } = await httpJson<AmadeusResponse>(`${this.baseUrl}/v2/shopping/flight-offers?${q}`, {
      headers: { authorization: `Bearer ${token}` },
      signal,
    });
    if (status !== 200) {
      throw new ProviderError(this.id, body?.errors?.[0]?.detail ?? `HTTP ${status}`, status);
    }
    const carriers = body.dictionaries?.carriers ?? {};
    return body.data.map((o) => this.map(o, carriers));
  }

  map(o: AmadeusOffer, carriers: Record<string, string>): Itinerary {
    const legs = o.itineraries.map((it) =>
      legFromSegments(
        it.segments.map((s): Segment => {
          const departLocal = s.departure.at.slice(0, 16);
          const arriveLocal = s.arrival.at.slice(0, 16);
          return {
            from: s.departure.iataCode,
            to: s.arrival.iataCode,
            departLocal,
            arriveLocal,
            departUtc: localToUtc(departLocal, airportTz(s.departure.iataCode)),
            arriveUtc: localToUtc(arriveLocal, airportTz(s.arrival.iataCode)),
            carrier: s.carrierCode,
            carrierName: carriers[s.carrierCode],
            flightNumber: s.number,
            durationMin: isoDurationToMinutes(s.duration),
          };
        }),
      ),
    );
    return finalize({
      id: `amadeus-${o.id}`,
      provider: this.id,
      providerName: this.name,
      legs,
      price: { amount: Number(o.price.grandTotal), currency: o.price.currency },
      seatsLeft: o.numberOfBookableSeats,
    });
  }
}
