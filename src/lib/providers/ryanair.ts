import { seatCount } from "@/lib/domain/types";
import type { Itinerary, Leg, SearchRequest, Segment } from "@/lib/domain/types";
import { airportTz } from "@/lib/data/airports";
import { hhmmToMinutes, localToUtc, minutesToHhmm } from "@/lib/domain/time";
import type { FlightProvider } from "./types";
import { ProviderError } from "./types";
import { TtlCache } from "./cache";
import { gateFor } from "./gate";
import { finalize, httpJson, legFromSegments } from "./util";

/** Ryanair charges a flat fee per infant per flight; children pay the adult fare. Approximation, EUR. */
const INFANT_FEE_PER_LEG = 25;

/**
 * Direct airline connector for Ryanair (FR and its group carriers RK, AL, …), no API key needed.
 *
 * Uses the public fare-finder endpoint that ryanair.com itself uses for its fare calendars.
 * That endpoint returns only the CHEAPEST flight inside a departure-time window, so to list
 * every flight of a day we split the window around each flight found until nothing is left:
 *   [00:00–23:59] → FR123 @ 09:15 → [00:00–09:14] + [09:16–23:59] → …
 * That costs about 2·n+1 requests for n flights. Day results are cached and requests are
 * throttled to stay polite.
 *
 * Env: RYANAIR_ENABLED=0 disables it. RYANAIR_BASE_URL overrides the host (tests, proxies).
 * Ryanair's website terms restrict automated use by third parties; for a public product,
 * get an agreement with Ryanair first.
 */

interface FarfndPrice {
  value: number;
  currencyCode: string;
}

interface FarfndAirport {
  iataCode: string;
  name: string;
}

export interface FarfndFare {
  outbound: {
    departureAirport: FarfndAirport;
    arrivalAirport: FarfndAirport;
    /** local wall-clock time at the departure airport, no offset */
    departureDate: string;
    /** local wall-clock time at the arrival airport, no offset */
    arrivalDate: string;
    price: FarfndPrice;
    flightKey: string;
    flightNumber: string;
  };
}

export interface FarfndResponse {
  fares: FarfndFare[];
  size: number;
}

type Requester = (url: string, signal?: AbortSignal) => Promise<{ status: number; body: FarfndResponse }>;

const MAX_REQUESTS_PER_DAY = 24;
const gate = gateFor("ryanair", { concurrency: 4, perMinute: 120 });
const dayCache = new TtlCache<FarfndFare[]>(10 * 60_000, 2000);

const defaultRequester: Requester = (url, signal) =>
  gate.run(() =>
    httpJson<FarfndResponse>(url, {
      headers: { accept: "application/json" },
      signal,
      timeoutMs: 15000,
    }),
  );

export class RyanairProvider implements FlightProvider {
  readonly id = "ryanair";
  readonly name = "Ryanair";
  readonly kind = "airline" as const;
  private readonly baseUrl: string;
  private readonly request: Requester;
  private readonly enabled: boolean;

  constructor(opts: { request?: Requester; baseUrl?: string; enabled?: boolean } = {}) {
    this.baseUrl = opts.baseUrl ?? process.env.RYANAIR_BASE_URL ?? "https://services-api.ryanair.com";
    this.request = opts.request ?? defaultRequester;
    this.enabled = opts.enabled ?? process.env.RYANAIR_ENABLED !== "0";
  }

  isConfigured(): boolean {
    return this.enabled;
  }

  async search(req: SearchRequest, signal?: AbortSignal): Promise<Itinerary[]> {
    // Ryanair sells a single cabin.
    if (req.cabin !== "economy") return [];
    const [outFares, backFares] = await Promise.all([
      this.day(req.origin, req.destination, req.departDate, req.currency, signal),
      req.returnDate ? this.day(req.destination, req.origin, req.returnDate, req.currency, signal) : Promise.resolve([]),
    ]);
    const outLegs = outFares.map((f) => ({ leg: this.toLeg(f), price: f.outbound.price }));
    if (!req.returnDate) {
      return outLegs.map((o) => this.itinerary(req, [o.leg], o.price.value, o.price.currencyCode));
    }
    const backLegs = backFares.map((f) => ({ leg: this.toLeg(f), price: f.outbound.price }));
    const out: Itinerary[] = [];
    for (const o of outLegs) {
      for (const b of backLegs) {
        // Same-day return must leave after landing, with at least two hours on the ground.
        if (Date.parse(b.leg.departUtc) - Date.parse(o.leg.arriveUtc) < 2 * 3600_000) continue;
        out.push(this.itinerary(req, [o.leg, b.leg], o.price.value + b.price.value, o.price.currencyCode));
      }
    }
    return out;
  }

  /** Every Ryanair flight between two airports on one local date. */
  async day(from: string, to: string, date: string, currency: string, signal?: AbortSignal): Promise<FarfndFare[]> {
    const key = `${from}-${to}-${date}-${currency}`;
    const hit = dayCache.get(key);
    if (hit) return hit;

    const found = new Map<string, FarfndFare>();
    let requests = 0;
    let windows: [number, number][] = [[0, 23 * 60 + 59]];
    while (windows.length && requests < MAX_REQUESTS_PER_DAY) {
      const batch = windows.slice(0, MAX_REQUESTS_PER_DAY - requests);
      windows = windows.slice(batch.length);
      requests += batch.length;
      const results = await Promise.all(batch.map(([a, b]) => this.cheapestIn(from, to, date, a, b, currency, signal)));
      batch.forEach(([a, b], i) => {
        const fare = results[i];
        if (!fare) return;
        const t = hhmmToMinutes(fare.outbound.departureDate.slice(11, 16));
        // Guard against the API ignoring the window: never split on an out-of-window answer.
        if (t < a || t > b || fare.outbound.departureDate.slice(0, 10) !== date) return;
        if (found.has(fare.outbound.flightKey)) return;
        found.set(fare.outbound.flightKey, fare);
        if (t - 1 >= a) windows.push([a, t - 1]);
        if (t + 1 <= b) windows.push([t + 1, b]);
      });
    }
    const list = [...found.values()].sort((x, y) => x.outbound.departureDate.localeCompare(y.outbound.departureDate));
    dayCache.set(key, list);
    return list;
  }

  private async cheapestIn(
    from: string,
    to: string,
    date: string,
    fromMin: number,
    toMin: number,
    currency: string,
    signal?: AbortSignal,
  ): Promise<FarfndFare | null> {
    const q = new URLSearchParams({
      departureAirportIataCode: from,
      arrivalAirportIataCode: to,
      outboundDepartureDateFrom: date,
      outboundDepartureDateTo: date,
      outboundDepartureTimeFrom: minutesToHhmm(fromMin),
      outboundDepartureTimeTo: minutesToHhmm(toMin),
      currency,
    });
    const { status, body } = await this.request(`${this.baseUrl}/farfnd/v4/oneWayFares?${q}`, signal);
    if (status !== 200) throw new ProviderError(this.id, `HTTP ${status}`, status);
    return body?.fares?.[0] ?? null;
  }

  toLeg(f: FarfndFare): Leg {
    const o = f.outbound;
    const from = o.departureAirport.iataCode;
    const to = o.arrivalAirport.iataCode;
    const departLocal = o.departureDate.slice(0, 16);
    const arriveLocal = o.arrivalDate.slice(0, 16);
    const departUtc = localToUtc(departLocal, airportTz(from));
    const arriveUtc = localToUtc(arriveLocal, airportTz(to));
    const m = /^([A-Z0-9]{2})\s?(\d+)$/.exec(o.flightNumber.trim());
    const seg: Segment = {
      from,
      to,
      departLocal,
      arriveLocal,
      departUtc,
      arriveUtc,
      carrier: m?.[1] ?? "FR",
      carrierName: "Ryanair",
      flightNumber: m?.[2] ?? o.flightNumber,
      durationMin: Math.round((Date.parse(arriveUtc) - Date.parse(departUtc)) / 60000),
    };
    return legFromSegments([seg]);
  }

  private itinerary(req: SearchRequest, legs: Leg[], pricePerAdult: number, currency: string): Itinerary {
    const out = legs[0];
    const back = legs[1];
    const q = new URLSearchParams({
      adults: String(req.adults),
      teens: "0",
      children: String(req.children ?? 0),
      infants: String(req.infants ?? 0),
      dateOut: out.departLocal.slice(0, 10),
      dateIn: back ? back.departLocal.slice(0, 10) : "",
      isConnectedFlight: "false",
      isReturn: String(Boolean(back)),
      discount: "0",
      originIata: out.from,
      destinationIata: out.to,
    });
    return finalize({
      id: `ryanair-${legs.map((l) => `${l.segments[0].carrier}${l.segments[0].flightNumber}@${l.departUtc}`).join("|")}`,
      provider: this.id,
      providerName: this.name,
      legs,
      price: { amount: Math.round((pricePerAdult * seatCount(req) + INFANT_FEE_PER_LEG * (req.infants ?? 0) * legs.length) * 100) / 100, currency },
      deepLink: `https://www.ryanair.com/gb/en/trip/flights/select?${q}`,
    });
  }
}

export function clearRyanairCache(): void {
  dayCache.clear();
}
