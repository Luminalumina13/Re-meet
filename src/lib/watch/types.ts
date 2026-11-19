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
  /** new_offer: how many offers are new, and how many exist in total */
  count?: number;
  total?: number;
}

export interface NotifyConfig {
  webhookUrl?: string;
  telegramChatId?: string;
  /** True only when the chat was linked through the bot (one-time link). Gates what the bot shows to that chat. */
  telegramVerified?: boolean;
  /** Language of the chat that linked the bot, for alert texts. */
  telegramLang?: "uk" | "en";
}

/** One-time token behind the "Connect Telegram" link. */
export interface TelegramLink {
  token: string;
  expiresAt: string;
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
  telegramLink?: TelegramLink;
  /** SHA-256 of the owner token (see owner.ts). Never sent to clients. */
  ownerHash?: string;
  /** Extra owner keys, one per browser that opened the tracker through the Telegram link (see telegram/claim.ts). */
  ownerHashes?: string[];
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
  Partial<Pick<Watch, "targetPrice" | "dropThreshold" | "notify" | "ownerHash">>;

export interface WatchStore {
  list(): Promise<Watch[]>;
  get(id: string): Promise<Watch | undefined>;
  create(w: NewWatch): Promise<Watch>;
  update(id: string, patch: Partial<Watch>): Promise<Watch | undefined>;
  delete(id: string): Promise<boolean>;
}
