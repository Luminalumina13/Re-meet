import type { Itinerary, ProviderStatus, SearchRequest, SearchResponse } from "@/lib/domain/types";
import { applyFilters, scoreAll } from "@/lib/domain/filters";
import type { FlightProvider } from "./types";
import { TtlCache } from "./cache";
import { providers as defaultProviders } from "./registry";

const cache = new TtlCache<{ raw: Itinerary[]; providers: ProviderStatus[] }>(5 * 60_000);

/** Cache key ignores soft filters so one upstream fetch serves many filter tweaks. */
function cacheKey(req: SearchRequest): string {
  const { filters: _f, ...rest } = req;
  void _f;
  return JSON.stringify(rest);
}

export interface AggregateOptions {
  providers?: FlightProvider[];
  /** Skip cache (used by the price tracker). */
  fresh?: boolean;
  signal?: AbortSignal;
}

/** Fetch from every configured provider in parallel; never fail the whole search for one vendor. */
export async function fetchRaw(
  req: SearchRequest,
  opts: AggregateOptions = {},
): Promise<{ raw: Itinerary[]; providers: ProviderStatus[]; cached: boolean }> {
  const key = cacheKey(req);
  if (!opts.fresh) {
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
  }
  const list = opts.providers ?? defaultProviders();
  const statuses: ProviderStatus[] = [];
  const results = await Promise.all(
    list.map(async (p) => {
      const t0 = Date.now();
      if (!p.isConfigured()) {
        statuses.push({ id: p.id, name: p.name, status: "skipped", count: 0, ms: 0, demo: p.demo });
        return [] as Itinerary[];
      }
      try {
        const its = await p.search(req, opts.signal);
        statuses.push({ id: p.id, name: p.name, status: "ok", count: its.length, ms: Date.now() - t0, demo: p.demo });
        return its;
      } catch (e) {
        statuses.push({
          id: p.id,
          name: p.name,
          status: "error",
          count: 0,
          ms: Date.now() - t0,
          error: e instanceof Error ? e.message : String(e),
          demo: p.demo,
        });
        return [] as Itinerary[];
      }
    }),
  );
  const raw = dedupe(results.flat());
  const value = { raw, providers: statuses.sort((a, b) => a.id.localeCompare(b.id)) };
  cache.set(key, value);
  return { ...value, cached: false };
}

/** Same flights sold by several vendors: keep the cheapest. */
export function dedupe(list: Itinerary[]): Itinerary[] {
  const best = new Map<string, Itinerary>();
  for (const it of list) {
    const prev = best.get(it.signature);
    if (!prev || it.price.amount < prev.price.amount) best.set(it.signature, it);
  }
  return [...best.values()];
}

export async function search(req: SearchRequest, opts: AggregateOptions = {}): Promise<SearchResponse> {
  const { raw, providers, cached } = await fetchRaw(req, opts);
  const filtered = applyFilters(raw, req.filters);
  const itineraries = scoreAll(filtered, req.filters).sort((a, b) => b.rank - a.rank);
  return { request: req, itineraries, providers, cached, generatedAt: new Date().toISOString() };
}

export function clearSearchCache(): void {
  cache.clear();
}
