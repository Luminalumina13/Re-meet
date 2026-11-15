import type { Itinerary, SearchRequest, Segment } from "@/lib/domain/types";
import type { FlightProvider } from "./types";
import { ProviderError } from "./types";
import { finalize, httpJson, legFromSegments } from "./util";

/**
 * Kiwi.com Tequila API connector. https://tequila.kiwi.com/portal/docs/tequila_api/search_api
 * Env: KIWI_API_KEY (required), KIWI_BASE_URL (optional, default https://api.tequila.kiwi.com)
 */

interface KiwiRoute {
  id: string;
  flyFrom: string;
  flyTo: string;
  airline: string;
  flight_no: number;
  local_departure: string;
  local_arrival: string;
  utc_departure: string;
  utc_arrival: string;
  return: 0 | 1;
}

interface KiwiItinerary {
  id: string;
  price: number;
  deep_link: string;
  availability?: { seats: number | null };
  route: KiwiRoute[];
}

interface KiwiResponse {
  data: KiwiItinerary[];
  currency: string;
}

function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const CABIN: Record<SearchRequest["cabin"], string> = {
  economy: "M",
  premium_economy: "W",
  business: "C",
  first: "F",
};

export class KiwiProvider implements FlightProvider {
  readonly id = "kiwi-tequila";
  readonly name = "Kiwi.com Tequila";
  readonly kind = "aggregator" as const;
  private readonly apiKey = process.env.KIWI_API_KEY ?? "";
  private readonly baseUrl = process.env.KIWI_BASE_URL ?? "https://api.tequila.kiwi.com";

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async search(req: SearchRequest, signal?: AbortSignal): Promise<Itinerary[]> {
    const q = new URLSearchParams({
      fly_from: req.origin,
      fly_to: req.destination,
      date_from: ddmmyyyy(req.departDate),
      date_to: ddmmyyyy(req.departDate),
      adults: String(req.adults),
      children: String(req.children ?? 0),
      infants: String(req.infants ?? 0),
      curr: req.currency,
      selected_cabins: CABIN[req.cabin],
      limit: "200",
      sort: "price",
    });
    if (req.returnDate) {
      q.set("return_from", ddmmyyyy(req.returnDate));
      q.set("return_to", ddmmyyyy(req.returnDate));
      q.set("flight_type", "round");
    } else {
      q.set("flight_type", "oneway");
    }
    if (req.filters?.maxStops !== undefined) q.set("max_stopovers", String(req.filters.maxStops));
    // Pass time hints to shrink payload (central filtering still applies).
    const o = req.filters?.outbound;
    const i = req.filters?.inbound;
    if (o?.departAfter) q.set("dtime_from", o.departAfter);
    if (o?.departBefore) q.set("dtime_to", o.departBefore);
    if (i?.arriveAfter) q.set("ret_atime_from", i.arriveAfter);
    if (i?.arriveBefore) q.set("ret_atime_to", i.arriveBefore);

    const { status, body } = await httpJson<KiwiResponse>(`${this.baseUrl}/v2/search?${q}`, {
      headers: { apikey: this.apiKey, accept: "application/json" },
      signal,
    });
    if (status !== 200) throw new ProviderError(this.id, `HTTP ${status}`, status);
    return body.data.map((it) => this.map(it, body.currency || req.currency));
  }

  map(it: KiwiItinerary, currency: string): Itinerary {
    const toSeg = (r: KiwiRoute): Segment => ({
      from: r.flyFrom,
      to: r.flyTo,
      departLocal: r.local_departure.slice(0, 16),
      arriveLocal: r.local_arrival.slice(0, 16),
      departUtc: new Date(r.utc_departure).toISOString(),
      arriveUtc: new Date(r.utc_arrival).toISOString(),
      carrier: r.airline,
      flightNumber: String(r.flight_no),
      durationMin: Math.round((Date.parse(r.utc_arrival) - Date.parse(r.utc_departure)) / 60000),
    });
    const out = it.route.filter((r) => r.return === 0).map(toSeg);
    const back = it.route.filter((r) => r.return === 1).map(toSeg);
    const legs = [legFromSegments(out)];
    if (back.length) legs.push(legFromSegments(back));
    return finalize({
      id: `kiwi-tequila-${it.id}`,
      provider: this.id,
      providerName: this.name,
      legs,
      price: { amount: it.price, currency },
      deepLink: it.deep_link,
      seatsLeft: it.availability?.seats ?? undefined,
    });
  }
}
