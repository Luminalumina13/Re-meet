import type { Cabin, IATA, ProviderStatus, ScoredItinerary, SearchFilters } from "@/lib/domain/types";

/** "Anywhere" weekend search: where can I fly from `origin` within `maxFlightHours` each way? */
export interface ExploreRequest {
  origin: IATA;
  departDate: string;
  returnDate: string;
  adults: number;
  children?: number;
  infants?: number;
  cabin: Cabin;
  currency: string;
  /** Door-to-door flight time limit per direction, hours (connections included). */
  maxFlightHours: number;
  filters?: SearchFilters;
}

export interface ExploreDestination {
  /** Grouping key: the destination city. */
  key: string;
  city: string;
  country?: string;
  /** Destination airports seen across options (e.g. STN, LTN for London). */
  airports: IATA[];
  /** Best option by combined comfort and price. */
  best: ScoredItinerary;
  cheapest: ScoredItinerary;
  options: number;
  /** Time on the ground in the destination for the best option, minutes. */
  minutesThere: number;
  imageUrl?: string;
}

export interface ExploreResponse {
  request: ExploreRequest;
  destinations: ExploreDestination[];
  providers: ProviderStatus[];
  generatedAt: string;
}
