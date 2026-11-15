import type { Cabin, IATA, Itinerary, ProviderStatus, SearchFilters } from "@/lib/domain/types";

export interface Friend {
  id: string;
  name: string;
  origin: IATA;
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
