import type { Itinerary, ProviderStatus, ScoredItinerary, SearchFilters } from "@/lib/domain/types";
import { applyFilters, scoreAll } from "@/lib/domain/filters";
import { getAirport } from "@/lib/data/airports";
import { dedupe, type AggregateOptions } from "@/lib/providers/aggregator";
import { providers as defaultProviders } from "@/lib/providers/registry";
import { TtlCache } from "@/lib/providers/cache";
import { localDate } from "@/lib/domain/time";
import { isRange, pairFits } from "@/lib/domain/dateRange";
import { mergeStatus } from "@/lib/meetup/engine";
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

/** Departure airports of a request: `origin` first, then the extra ones. */
export function exploreOrigins(req: Pick<ExploreRequest, "origin" | "origins">): string[] {
  return [...new Set([req.origin, ...(req.origins ?? [])])];
}

/** Round trip within the requested dates (a provider searching a range may stray a day either side). */
export function withinDates(it: Itinerary, req: ExploreRequest): boolean {
  const [out, back] = it.legs;
  if (!back) return false;
  const d = localDate(out.departLocal);
  const r = localDate(back.departLocal);
  if (!isRange(req)) return true;
  if (d < req.departDate || d > (req.departUntil ?? req.departDate)) return false;
  if (r < req.returnDate || r > (req.returnUntil ?? req.returnDate)) return false;
  return pairFits(req, d, r);
}

async function exploreFrom(req: ExploreRequest, origin: string, opts: AggregateOptions) {
  const one: ExploreRequest = { ...req, origin, origins: undefined };
  const key = JSON.stringify({ ...one, filters: undefined, f: req.filters });
  const hit = opts.fresh ? undefined : cache.get(key);
  if (hit) return hit;
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
        const its = await p.explore(one, opts.signal);
        statuses.push({ id: p.id, name: p.name, kind: p.kind, status: "ok", count: its.length, ms: Date.now() - t0, demo: p.demo });
        return its;
      } catch (e) {
        statuses.push({ id: p.id, name: p.name, kind: p.kind, status: "error", count: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e), demo: p.demo });
        return [] as Itinerary[];
      }
    }),
  );
  const fetched = { raw: dedupe(results.flat()), providers: statuses };
  if (!opts.signal?.aborted && statuses.every((s) => s.status !== "error")) cache.set(key, fetched);
  return fetched;
}

export async function explore(req: ExploreRequest, opts: AggregateOptions = {}): Promise<ExploreResponse> {
  const filters: SearchFilters = { ...req.filters, maxDurationMin: Math.round(req.maxFlightHours * 60) };
  const origins = exploreOrigins(req);
  const parts = await Promise.all(origins.map((o) => exploreFrom(req, o, opts)));
  const statuses = new Map<string, ProviderStatus>();
  for (const part of parts) for (const s of part.providers) mergeStatus(statuses, s);

  // Never offer a departure city as a destination.
  const homeCities = new Set(origins.map((o) => getAirport(o)?.city?.toLowerCase()).filter(Boolean));
  const usable = applyFilters(dedupe(parts.flatMap((p) => p.raw)), filters).filter((it) => it.legs.length === 2 && !homeCities.has(cityOf(it).key) && withinDates(it, req));
  const scored = scoreAll(usable, filters);
  return {
    request: req,
    destinations: groupByCity(scored),
    providers: [...statuses.values()].sort((a, b) => a.id.localeCompare(b.id)),
    generatedAt: new Date().toISOString(),
  };
}
