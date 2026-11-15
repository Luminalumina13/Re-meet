import type { SearchRequest } from "@/lib/domain/types";
import type { MeetupRequest } from "@/lib/meetup/types";
import type { ExploreRequest } from "@/lib/explore/types";

export interface PricePoint {
  at: string;
  bestPrice: number;
  count: number;
}

export type AlertType = "price_drop" | "price_rise" | "new_offer" | "target_reached" | "no_results";

export interface Alert {
  id: string;
  at: string;
  type: AlertType;
  message: string;
  price?: number;
  previousPrice?: number;
  /** signatures of newly seen itineraries (for new_offer) */
  signatures?: string[];
}

export interface NotifyConfig {
  webhookUrl?: string;
  telegramChatId?: string;
}

export type WatchParams =
  | { kind: "search"; request: SearchRequest }
  | { kind: "meetup"; request: MeetupRequest }
  | { kind: "explore"; request: ExploreRequest };

export interface Watch {
  id: string;
  label: string;
  params: WatchParams;
  currency: string;
  targetPrice?: number;
  /** minimal relative drop to alert on, e.g. 0.05 = 5 % */
  dropThreshold: number;
  notify: NotifyConfig;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  lastBestPrice?: number;
  lastCount?: number;
  /** Signatures seen so far; new ones trigger "new_offer". */
  knownSignatures: string[];
  history: PricePoint[];
  alerts: Alert[];
}

export type NewWatch = Pick<Watch, "label" | "params" | "currency"> &
  Partial<Pick<Watch, "targetPrice" | "dropThreshold" | "notify">>;

export interface WatchStore {
  list(): Promise<Watch[]>;
  get(id: string): Promise<Watch | undefined>;
  create(w: NewWatch): Promise<Watch>;
  update(id: string, patch: Partial<Watch>): Promise<Watch | undefined>;
  delete(id: string): Promise<boolean>;
}
