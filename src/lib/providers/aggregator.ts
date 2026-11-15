import type { Itinerary, ProviderStatus, SearchRequest, SearchResponse } from "@/lib/domain/types";
import { applyFilters, scoreAll } from "@/lib/domain/filters";
import type { FlightProvider } from "./types";
import { TtlCache } from "./cache";
import { providers as defaultProviders } from "./registry";
import { detailScore, tripKey } from "./util";

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
        statuses.push({ id: p.id, name: p.name, kind: p.kind, status: "skipped", count: 0, ms: 0, demo: p.demo });
        return [] as Itinerary[];
      }
      try {
        const its = await p.search(req, opts.signal);
        statuses.push({ id: p.id, name: p.name, kind: p.kind, status: "ok", count: its.length, ms: Date.now() - t0, demo: p.demo });
        return its;
      } catch (e) {
        statuses.push({
          id: p.id,
          name: p.name,
          kind: p.kind,
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
  // Never cache failures: an aborted request (user navigated away) or a source outage would
  // otherwise be served to everyone for the cache lifetime.
  if (!opts.signal?.aborted && statuses.every((s) => s.status !== "error")) cache.set(key, value);
  return { ...value, cached: false };
}

/**
 * Same flights sold by several sources: one entry with the cheapest price and booking link,
 * the most detailed flight description, and the other sources' prices for comparison.
 */
export function dedupe(list: Itinerary[]): Itinerary[] {
  const groups = new Map<string, Itinerary[]>();
  for (const it of list) {
    const k = tripKey(it.legs);
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  }
  const out: Itinerary[] = [];
  for (const g of groups.values()) {
    if (g.length === 1) {
      out.push(g[0]);
      continue;
    }
    const byPrice = [...g].sort((a, b) => a.price.amount - b.price.amount);
    const cheapest = byPrice[0];
    const richest = [...g].sort((a, b) => detailScore(b) - detailScore(a))[0];
    const seen = new Set([cheapest.provider]);
    const otherOffers = byPrice.slice(1).filter((o) => !seen.has(o.provider) && seen.add(o.provider)).map((o) => ({
      provider: o.provider,
      providerName: o.providerName,
      price: o.price,
      deepLink: o.deepLink,
    }));
    out.push({ ...cheapest, legs: richest.legs, signature: richest.signature, otherOffers });
  }
  return out;
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
