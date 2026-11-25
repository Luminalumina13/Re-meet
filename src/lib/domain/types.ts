/** Core domain model shared by providers, the meetup engine, the API and the UI. */

export type IATA = string;

export interface Airport {
  iata: IATA;
  name: string;
  city: string;
  country: string; // ISO-3166 alpha-2
  /** IANA time zone, e.g. "Europe/Kyiv" */
  tz: string;
  lat: number;
  lon: number;
  /** Absent for the curated core list (treated as large); set for the airports imported from OurAirports. */
  size?: "large" | "medium" | "small";
}

export interface Money {
  amount: number;
  currency: string;
}

/** A single flight (one take-off, one landing). */
export interface Segment {
  from: IATA;
  to: IATA;
  /** Local wall-clock time at the origin, ISO without offset: "2026-11-21T08:35" */
  departLocal: string;
  /** Local wall-clock time at the destination, ISO without offset */
  arriveLocal: string;
  /** Absolute instants, ISO-8601 UTC */
  departUtc: string;
  arriveUtc: string;
  carrier: string; // IATA airline code
  carrierName?: string;
  flightNumber: string;
  durationMin: number;
}

/** One direction of travel (outbound or return), possibly with connections. */
export interface Leg {
  from: IATA;
  to: IATA;
  departLocal: string;
  arriveLocal: string;
  departUtc: string;
  arriveUtc: string;
  durationMin: number;
  stops: number;
  segments: Segment[];
  /** Destination city/country names when the source provides them (for airports outside our table). */
  toCity?: string;
  toCountry?: string;
}

export interface Itinerary {
  /** Stable id: provider-scoped. */
  id: string;
  provider: string;
  providerName: string;
  /** One leg for one-way, two for round-trip. */
  legs: Leg[];
  price: Money;
  deepLink?: string;
  seatsLeft?: number;
  /** Deterministic fingerprint of the flights (carrier+number+departUtc per segment). */
  signature: string;
  /** The same flights offered by other sources, cheapest first (filled in by the aggregator). */
  otherOffers?: Offer[];
  /** Destination photo, when the source provides one. */
  imageUrl?: string;
}

export interface Offer {
  provider: string;
  providerName: string;
  price: Money;
  deepLink?: string;
}

export type Cabin = "economy" | "premium_economy" | "business" | "first";

/** Wall-clock constraints for one leg. All values "HH:MM" local to the relevant airport. */
export interface TimeWindow {
  departAfter?: string;
  departBefore?: string;
  arriveAfter?: string;
  arriveBefore?: string;
}

export interface SearchFilters {
  outbound?: TimeWindow;
  inbound?: TimeWindow;
  /** 0 = direct only */
  maxStops?: number;
  maxPrice?: number;
  carriers?: string[];
  /** Upper bound on each leg's door-to-door flight time, minutes (connections included). */
  maxDurationMin?: number;
}

export interface SearchRequest {
  origin: IATA;
  destination: IATA;
  departDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD, absent = one-way
  /** Travellers aged 12+. */
  adults: number;
  /** Children aged 2–11 (own seat, usually discounted). Absent = 0. */
  children?: number;
  /** Infants under 2 (on an adult's lap, a fraction of the fare). Absent = 0. */
  infants?: number;
  cabin: Cabin;
  currency: string;
  filters?: SearchFilters;
  /**
   * Only the cheapest fares matter (date grids, ranges): sources answer with one price-sorted call
   * instead of splitting the day into departure-time windows. Set by the server, not by visitors.
   */
  quick?: boolean;
}

/** Number of seats that pay a full or child fare (infants fly on a lap). */
export function seatCount(req: { adults: number; children?: number }): number {
  return req.adults + (req.children ?? 0);
}

export type ProviderKind = "airline" | "aggregator" | "demo";

export interface ProviderStatus {
  id: string;
  name: string;
  kind: ProviderKind;
  status: "ok" | "error" | "skipped";
  count: number;
  ms: number;
  error?: string;
  /** Some of this source's calls failed: the list may miss flights. */
  partial?: boolean;
  demo?: boolean;
}

export interface SearchResponse {
  request: SearchRequest;
  itineraries: ScoredItinerary[];
  providers: ProviderStatus[];
  cached: boolean;
  generatedAt: string;
}

export interface ComfortBreakdown {
  /** 0..1 how well the outbound departure fits the window */
  outboundDeparture: number;
  /** 0..1 how well the return arrival fits the window (1 if one-way) */
  inboundArrival: number;
  /** 0..1 penalty-free for direct flights */
  directness: number;
  /** 0..1 shorter total travel time is better */
  speed: number;
}

export interface ScoredItinerary extends Itinerary {
  /** 0..100 combined comfort score */
  comfort: number;
  comfortBreakdown: ComfortBreakdown;
  /** Composite ranking score (higher is better) mixing price and comfort */
  rank: number;
  /** Human-readable badges e.g. "morning-departure", "evening-return", "direct" */
  badges: string[];
}
