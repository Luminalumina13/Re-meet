import type { Itinerary, SearchRequest } from "@/lib/domain/types";

/**
 * A flight data connector. Implementations map a vendor API onto the domain model.
 * They must not filter by time windows — that is done centrally — but may pass hints
 * to the vendor to reduce payload.
 */
export interface FlightProvider {
  readonly id: string;
  readonly name: string;
  /** True when demo/synthetic data is returned. */
  readonly demo?: boolean;
  /** Whether credentials/config are present. Unconfigured providers are skipped. */
  isConfigured(): boolean;
  search(req: SearchRequest, signal?: AbortSignal): Promise<Itinerary[]>;
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = "ProviderError";
  }
}
