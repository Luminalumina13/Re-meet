import { partialFields } from "@/lib/providers/partial";
import type { Itinerary, ProviderStatus } from "@/lib/domain/types";
import { applyFilters } from "@/lib/domain/filters";
import { localDate } from "@/lib/domain/time";
import { pairFits } from "@/lib/domain/dateRange";
import { dedupe, type AggregateOptions } from "@/lib/providers/aggregator";
import { providers as defaultProviders } from "@/lib/providers/registry";
import { TtlCache } from "@/lib/providers/cache";
import type { RangeSearchRequest } from "@/lib/providers/types";

export interface RangePair {
  depart: string;
  /** Absent for one way. */
  ret?: string;
  price: number;
  providerName: string;
}

export interface RangeResponse {
  pairs: RangePair[];
  providers: ProviderStatus[];
  /** False when no source can search a range; the page then prices the days one by one. */
  supported: boolean;
}

const cache = new TtlCache<RangeResponse>(10 * 60_000, 500);

/** Does this trip leave and come back inside the requested windows (and nights)? */
export function insideRange(it: Itinerary, req: RangeSearchRequest): boolean {
  const [out, back] = it.legs;
  const d = localDate(out.departLocal);
  if (d < req.departDate || d > (req.departUntil ?? req.departDate)) return false;
  if (!req.returnDate) return !back;
  if (!back) return false;
  const r = localDate(back.departLocal);
  if (r < req.returnDate || r > (req.returnUntil ?? req.returnDate)) return false;
  return pairFits(req, d, r);
}

/** Cheapest trip per departure/return day pair, from the sources that search date ranges themselves. */
export async function rangeSearch(req: RangeSearchRequest, opts: AggregateOptions = {}): Promise<RangeResponse> {
  const key = JSON.stringify(req);
  const hit = opts.fresh ? undefined : cache.get(key);
  if (hit) return hit;
  const list = (opts.providers ?? defaultProviders()).filter((p) => p.searchRange && p.isConfigured());
  const statuses: ProviderStatus[] = [];
  const results = await Promise.all(
    list.map(async (p) => {
      const t0 = Date.now();
      try {
        const its = await p.searchRange!(req, opts.signal);
        statuses.push({ id: p.id, name: p.name, kind: p.kind, status: "ok", count: its.length, ms: Date.now() - t0, demo: p.demo, ...partialFields(its) });
        return its;
      } catch (e) {
        statuses.push({ id: p.id, name: p.name, kind: p.kind, status: "error", count: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e), demo: p.demo });
        return [] as Itinerary[];
      }
    }),
  );
  const best = new Map<string, RangePair>();
  for (const it of applyFilters(dedupe(results.flat(), req.filters?.bags), req.filters ?? {})) {
    if (!insideRange(it, req)) continue;
    const depart = localDate(it.legs[0].departLocal);
    const ret = it.legs[1] ? localDate(it.legs[1].departLocal) : undefined;
    const k = `${depart}|${ret ?? ""}`;
    const cur = best.get(k);
    if (!cur || it.price.amount < cur.price) best.set(k, { depart, ret, price: Math.round(it.price.amount), providerName: it.providerName });
  }
  const res: RangeResponse = {
    pairs: [...best.values()].sort((a, b) => a.price - b.price || a.depart.localeCompare(b.depart)),
    providers: statuses,
    supported: list.length > 0,
  };
  if (!opts.signal?.aborted && statuses.every((s) => s.status === "ok" && !s.partial)) cache.set(key, res);
  return res;
}
