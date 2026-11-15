import type { Itinerary, ProviderStatus, ScoredItinerary, SearchFilters } from "@/lib/domain/types";
import { applyFilters, scoreAll } from "@/lib/domain/filters";
import { getAirport } from "@/lib/data/airports";
import { dedupe, type AggregateOptions } from "@/lib/providers/aggregator";
import { providers as defaultProviders } from "@/lib/providers/registry";
import { TtlCache } from "@/lib/providers/cache";
import type { ExploreDestination, ExploreRequest, ExploreResponse } from "./types";

const cache = new TtlCache<{ raw: Itinerary[]; providers: ProviderStatus[] }>(10 * 60_000, 200);

export function cityOf(it: Itinerary): { key: string; city: string; country?: string } {
  const leg = it.legs[0];
  const a = getAirport(leg.to);
  const city = leg.toCity ?? a?.city ?? leg.to;
  return { key: city.toLowerCase(), city, country: leg.toCountry ?? a?.country };
}

export function minutesThere(it: Itinerary): number {
  const [out, back] = it.legs;
  if (!back) return 0;
  return Math.round((Date.parse(back.departUtc) - Date.parse(out.arriveUtc)) / 60000);
}

/** Group scored round trips by destination city, best option first. Pure, for tests. */
export function groupByCity(list: ScoredItinerary[]): ExploreDestination[] {
  const groups = new Map<string, ScoredItinerary[]>();
  for (const it of list) {
    const { key } = cityOf(it);
    const g = groups.get(key);
    if (g) g.push(it);
    else groups.set(key, [it]);
  }
  const out: ExploreDestination[] = [];
  for (const [key, g] of groups) {
    const best = [...g].sort((a, b) => b.rank - a.rank || a.price.amount - b.price.amount)[0];
    const cheapest = [...g].sort((a, b) => a.price.amount - b.price.amount)[0];
    const info = cityOf(best);
    out.push({
      key,
      city: info.city,
      country: info.country,
      airports: [...new Set(g.map((i) => i.legs[0].to))],
      best,
      cheapest,
      options: g.length,
      minutesThere: minutesThere(best),
      imageUrl: g.find((i) => i.imageUrl)?.imageUrl,
    });
  }
  return out.sort((a, b) => b.best.rank - a.best.rank || a.cheapest.price.amount - b.cheapest.price.amount);
}

export async function explore(req: ExploreRequest, opts: AggregateOptions = {}): Promise<ExploreResponse> {
  const filters: SearchFilters = { ...req.filters, maxDurationMin: Math.round(req.maxFlightHours * 60) };
  const key = JSON.stringify({ ...req, filters: undefined, f: req.filters });
  let fetched = opts.fresh ? undefined : cache.get(key);

  if (!fetched) {
    const list = opts.providers ?? defaultProviders();
    const statuses: ProviderStatus[] = [];
    const results = await Promise.all(
      list.map(async (p) => {
        if (!p.explore || !p.isConfigured()) {
          statuses.push({ id: p.id, name: p.name, kind: p.kind, status: "skipped", count: 0, ms: 0, demo: p.demo });
          return [] as Itinerary[];
        }
        const t0 = Date.now();
        try {
          const its = await p.explore(req, opts.signal);
          statuses.push({ id: p.id, name: p.name, kind: p.kind, status: "ok", count: its.length, ms: Date.now() - t0, demo: p.demo });
          return its;
        } catch (e) {
          statuses.push({ id: p.id, name: p.name, kind: p.kind, status: "error", count: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e), demo: p.demo });
          return [] as Itinerary[];
        }
      }),
    );
    fetched = { raw: dedupe(results.flat()), providers: statuses.sort((a, b) => a.id.localeCompare(b.id)) };
    if (!opts.signal?.aborted && statuses.every((s) => s.status !== "error")) cache.set(key, fetched);
  }

  // Never offer the origin's own city as a destination.
  const originCity = getAirport(req.origin)?.city?.toLowerCase();
  const usable = applyFilters(fetched.raw, filters).filter((it) => it.legs.length === 2 && cityOf(it).key !== originCity);
  const scored = scoreAll(usable, filters);
  return {
    request: req,
    destinations: groupByCity(scored),
    providers: fetched.providers,
    generatedAt: new Date().toISOString(),
  };
}
