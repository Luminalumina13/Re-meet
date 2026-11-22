import type { Cabin, IATA, Itinerary, ProviderStatus, SearchFilters } from "@/lib/domain/types";

export interface Friend {
  id: string;
  name: string;
  /** Airports this friend can fly from (e.g. two cities nearby). The planner picks the best one. */
  origins: IATA[];
}

export interface MeetupRequest {
  friends: Friend[];
  /** Candidate meeting cities; the engine ranks plans across all of them. */
  destinations: IATA[];
  departDate: string;
  returnDate: string;
  cabin: Cabin;
  currency: string;
  filters?: SearchFilters;
  /** How much one extra hour together is worth, in `currency`. Trades time against price. */
  valuePerHour: number;
  maxBudgetPerPerson?: number;
  minTogetherHours?: number;
  topK?: number;
}

export interface FriendPlan {
  friend: Friend;
  /** null when the friend already lives in the destination (host). */
  outbound: Itinerary | null;
  inbound: Itinerary | null;
  arriveUtc: string | null;
  departUtc: string | null;
  price: number;
}

/** Two friends who sit on the same flight for part of their way (one boards in the other's city, or both at a hub). */
export interface SharedFlight {
  flight: string;
  from: IATA;
  to: IATA;
  friendIds: [string, string];
  direction: "outbound" | "inbound";
}

/** Two friends whose chosen flights wait at the same connecting airport at the same time. */
export interface LayoverMeet {
  airport: IATA;
  minutes: number;
  startUtc: string;
  endUtc: string;
  friendIds: [string, string];
  direction: "outbound" | "inbound";
}

export interface MeetupPlan {
  id: string;
  destination: IATA;
  togetherMinutes: number;
  totalPrice: number;
  currency: string;
  meetStartUtc: string;
  meetEndUtc: string;
  /** Local to the destination */
  meetStartLocal: string;
  meetEndLocal: string;
  friends: FriendPlan[];
  /** Chance to meet on the way, at a shared connection (not counted in the time together). */
  layoverMeets?: LayoverMeet[];
  /** Flights the friends share, so they travel on together. */
  sharedFlights?: SharedFlight[];
  /** valuePerHour * hours - price; higher is better */
  score: number;
}

export interface MeetupResponse {
  request: MeetupRequest;
  plans: MeetupPlan[];
  /** Pareto frontier (more time together vs. lower price) among all evaluated plans. */
  frontier: { planId: string; destination: IATA; togetherMinutes: number; totalPrice: number }[];
  providers: ProviderStatus[];
  /** Friends with no usable flights for a destination. */
  unreachable: { destination: IATA; friendId: string; direction: "outbound" | "inbound" }[];
  generatedAt: string;
}
