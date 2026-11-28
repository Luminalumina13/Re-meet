import { markPartial } from "./partial";
import { wantsBags, type Itinerary, type Leg, type SearchFilters, type SearchRequest, type Segment } from "@/lib/domain/types";
import { getAirport } from "@/lib/data/airports";
import { hhmmToMinutes, localToUtc } from "@/lib/domain/time";
import type { FlightProvider } from "./types";
import { ProviderError } from "./types";
import { TtlCache } from "./cache";
import { gateFor } from "./gate";
import { finalize, httpJson } from "./util";
import type { ExploreRequest } from "@/lib/explore/types";
import type { RangeSearchRequest } from "./types";
import { rangeDays } from "@/lib/domain/dateRange";

/**
 * Kiwi.com connector over its public MCP server (https://mcp.kiwi.com), no API key needed.
 * Covers hundreds of airlines, including low-cost carriers (Ryanair, Wizz Air, easyJet, Vueling…)
 * and Kiwi's self-transfer combinations.
 *
 * One call returns at most ~15 itineraries, so the day is split into departure-hour windows
 * that are queried in parallel; the central filters and ranking then work on the union.
 *
 * Env: KIWI_MCP_ENABLED=0 disables it. KIWI_MCP_URL overrides the endpoint.
 * The server is published for AI assistants; for a public commercial product, agree terms with Kiwi.com.
 */

interface KiwiSeg {
  from: string;
  to: string;
  toCity?: string;
  toCountry?: string;
  departureTime: string;
  arrivalTime: string;
  durationSeconds?: number;
  carrier: string;
  carrierName?: string;
  flightNumber: string;
}

interface KiwiLeg {
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  durationSeconds: number;
  stops: number;
  segments: KiwiSeg[];
}

export interface KiwiMcpItinerary {
  id: string;
  tripType: "oneway" | "return";
  price: number;
  bookingUrl?: string;
  imageId?: string;
  baggage?: { personalItem?: number; cabinBag?: number; checkedBag?: number };
  outbound: KiwiLeg;
  inbound?: KiwiLeg;
}

export interface KiwiMcpResult {
  currency: string;
  resultsCount: number;
  itineraries: KiwiMcpItinerary[];
  error?: string | null;
}

interface RpcResponse {
  result?: { isError?: boolean; structuredContent?: KiwiMcpResult; content?: { type?: string; text?: string }[] };
  error?: { message: string };
}

export type McpCaller = (tool: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<KiwiMcpResult>;

/** Departure-hour windows, inclusive. Four windows ≈ up to 60 itineraries per day. */
const WINDOWS: [number, number][] = [
  [0, 9],
  [10, 13],
  [14, 17],
  [18, 23],
];

// Shared by every visitor: concurrency, requests per minute and a pause after 429s (see gate.ts).
const gate = gateFor("kiwi", { concurrency: Number(process.env.KIWI_MCP_CONCURRENCY ?? 8), perMinute: 120 });
const cache = new TtlCache<KiwiMcpResult>(10 * 60_000, 2000);
let rpcId = 0;

/** Parse a Streamable-HTTP MCP reply: either plain JSON or an SSE stream of `data:` lines. */
export function parseRpc(body: string): RpcResponse {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed) as RpcResponse;
  const data = trimmed
    .split(/\r?\n/)
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  if (!data.length) throw new Error("Empty MCP response");
  return JSON.parse(data[data.length - 1]) as RpcResponse;
}

export function httpMcpCaller(url: string): McpCaller {
  return async (tool, args, signal) => {
    const { status, body } = await gate.run(() =>
      httpJson<string>(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-06-18",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name: tool, arguments: args } }),
        signal,
        timeoutMs: 30000,
      }),
    );
    if (status !== 200) throw new ProviderError("kiwi", `MCP HTTP ${status}`, status);
    const msg = parseRpc(typeof body === "string" ? body : JSON.stringify(body));
    if (msg.error) throw new ProviderError("kiwi", msg.error.message);
    const r = msg.result;
    if (!r) throw new ProviderError("kiwi", "MCP response without result");
    const sc = r.structuredContent ?? (r.content?.[0]?.text ? (JSON.parse(r.content[0].text) as KiwiMcpResult) : undefined);
    if (r.isError || !sc) throw new ProviderError("kiwi", r.content?.[0]?.text?.slice(0, 200) ?? "tool error");
    if (sc.error) throw new ProviderError("kiwi", sc.error);
    return sc;
  };
}

function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const CABIN: Record<SearchRequest["cabin"], string> = { economy: "M", premium_economy: "W", business: "C", first: "F" };

/** Hour bounds implied by an "HH:MM" window, widened to whole hours (central filters trim the rest). */
function hourBounds(after?: string, before?: string): [number, number] {
  const lo = after ? Math.floor(hhmmToMinutes(after) / 60) : 0;
  const hi = before ? Math.min(23, Math.floor(hhmmToMinutes(before) / 60)) : 23;
  return [lo, hi];
}

export class KiwiMcpProvider implements FlightProvider {
  readonly id = "kiwi";
  readonly name = "Kiwi.com";
  readonly kind = "aggregator" as const;
  private readonly call: McpCaller;
  private readonly enabled: boolean;

  constructor(opts: { call?: McpCaller; enabled?: boolean } = {}) {
    this.call = opts.call ?? httpMcpCaller(process.env.KIWI_MCP_URL ?? "https://mcp.kiwi.com");
    this.enabled = opts.enabled ?? process.env.KIWI_MCP_ENABLED !== "0";
  }

  isConfigured(): boolean {
    return this.enabled;
  }

  private baseArgs(
    q: { origin: string; destination: string; departDate: string; returnDate?: string; adults: number; children?: number; infants?: number; cabin: SearchRequest["cabin"]; currency: string },
    f: SearchFilters,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      flyFrom: q.origin,
      flyTo: q.destination,
      departureDate: ddmmyyyy(q.departDate),
      adults: q.adults,
      children: q.children ?? 0,
      infants: q.infants ?? 0,
      cabinClass: CABIN[q.cabin],
      currency: q.currency,
      sort: "price",
      locale: "en",
    };
    if (q.returnDate) {
      base.returnDate = ddmmyyyy(q.returnDate);
      const [rLo, rHi] = hourBounds(f.inbound?.arriveAfter, f.inbound?.arriveBefore);
      if (rLo > 0) base.ret_atime_from = rLo;
      if (rHi < 23) base.ret_atime_to = rHi;
    }
    if (f.maxStops !== undefined) base.max_sector_stopovers = f.maxStops;
    if (f.maxPrice !== undefined) base.price_to = Math.ceil(f.maxPrice);
    if (f.carriers?.length) base.select_airlines = f.carriers.join(",");
    if (f.maxDurationMin !== undefined) base.max_fly_duration = Math.ceil(f.maxDurationMin / 60);
    // Bags per traveller: Kiwi then quotes the fare with them (airline fees included).
    if (wantsBags(f.bags)) {
      const each = (n: number, v: number) => Array.from({ length: n }, () => v);
      const kids = q.children ?? 0;
      base.adults_hand_bags = each(q.adults, f.bags?.cabin ?? 0);
      base.adults_hold_bags = each(q.adults, f.bags?.checked ?? 0);
      if (kids) {
        base.children_hand_bags = each(kids, f.bags?.cabin ?? 0);
        base.children_hold_bags = each(kids, f.bags?.checked ?? 0);
      }
    }
    return base;
  }

  /** Split the outbound departure window into the standard hour windows. */
  private windowed(base: Record<string, unknown>, f: SearchFilters): Record<string, unknown>[] {
    const [dLo, dHi] = hourBounds(f.outbound?.departAfter, f.outbound?.departBefore);
    return WINDOWS.filter(([a, b]) => b >= dLo && a <= dHi).map(([a, b]) => ({
      ...base,
      dtime_from: Math.max(a, dLo),
      dtime_to: Math.min(b, dHi),
    }));
  }

  /** The query plan: one tool call per departure window that overlaps the requested outbound window. */
  plan(req: SearchRequest): Record<string, unknown>[] {
    const f: SearchFilters = req.filters ?? {};
    if (req.quick) {
      // One call for the whole requested window: the cheapest ~15 fares are all a price grid needs.
      const [dLo, dHi] = hourBounds(f.outbound?.departAfter, f.outbound?.departBefore);
      return [{ ...this.baseArgs(req, f), dtime_from: dLo, dtime_to: dHi }];
    }
    return this.windowed(this.baseArgs(req, f), f);
  }

  /** Plan for an "anywhere" search: every reachable city, one best option per city per window. */
  explorePlan(req: ExploreRequest): Record<string, unknown>[] {
    const f: SearchFilters = { ...req.filters, maxDurationMin: Math.round(req.maxFlightHours * 60) };
    const base = this.baseArgs({ ...req, destination: "anywhere" }, f);
    base.one_for_city = true;
    // Kiwi searches date ranges itself: one call covers every day pair.
    if (req.departUntil && req.departUntil > req.departDate) base.departureDateTo = ddmmyyyy(req.departUntil);
    if (req.returnUntil && req.returnUntil > req.returnDate) base.returnDateTo = ddmmyyyy(req.returnUntil);
    if (req.minNights !== undefined) base.nights_in_dst_from = req.minNights;
    if (req.maxNights !== undefined) base.nights_in_dst_to = req.maxNights;
    return this.windowed(base, f);
  }

  /**
   * Plan for a date range: the departure window is cut into at most 4 parts (each call returns
   * ~15 trips, cheapest first, so this spreads them over the range), the return is a window or a
   * number of nights. Kiwi prices real round trips, not sums of one-way tickets.
   */
  rangePlan(req: RangeSearchRequest): Record<string, unknown>[] {
    const f: SearchFilters = req.filters ?? {};
    const days = rangeDays(req.departDate, req.departUntil);
    const parts = Math.min(4, days.length);
    const size = Math.ceil(days.length / parts);
    const byNights = req.minNights !== undefined || req.maxNights !== undefined;
    const [dLo, dHi] = hourBounds(f.outbound?.departAfter, f.outbound?.departBefore);
    const out: Record<string, unknown>[] = [];
    for (let i = 0; i < days.length; i += size) {
      const chunk = days.slice(i, i + size);
      const args = this.baseArgs({ ...req, departDate: chunk[0], returnDate: byNights ? undefined : req.returnDate }, f);
      if (chunk.length > 1) args.departureDateTo = ddmmyyyy(chunk[chunk.length - 1]);
      if (dLo > 0) args.dtime_from = dLo;
      if (dHi < 23) args.dtime_to = dHi;
      if (byNights) {
        if (req.minNights !== undefined) args.nights_in_dst_from = req.minNights;
        if (req.maxNights !== undefined) args.nights_in_dst_to = req.maxNights;
      } else if (req.returnDate && req.returnUntil && req.returnUntil > req.returnDate) {
        args.returnDateTo = ddmmyyyy(req.returnUntil);
      }
      out.push(args);
    }
    return out;
  }

  async searchRange(req: RangeSearchRequest, signal?: AbortSignal): Promise<Itinerary[]> {
    const results = await Promise.allSettled(this.rangePlan(req).map(async (args) => [await this.cachedCall(args, signal)]));
    return this.collect(results, req.currency);
  }

  private async cachedCall(args: Record<string, unknown>, signal?: AbortSignal): Promise<KiwiMcpResult> {
    const key = JSON.stringify(args);
    const hit = cache.get(key);
    if (hit) return hit;
    const res = await this.call("search-flight", args, signal);
    cache.set(key, res);
    return res;
  }

  private collect(results: PromiseSettledResult<KiwiMcpResult[]>[], currency: string): Itinerary[] {
    const ok = results.filter((r): r is PromiseFulfilledResult<KiwiMcpResult[]> => r.status === "fulfilled");
    if (!ok.length && results.length) throw (results[0] as PromiseRejectedResult).reason;
    const seen = new Set<string>();
    const out: Itinerary[] = [];
    for (const r of ok)
      for (const page of r.value)
        for (const it of page.itineraries ?? []) {
          if (seen.has(it.id)) continue;
          seen.add(it.id);
          const mapped = this.map(it, page.currency || currency);
          if (mapped) out.push(mapped);
        }
    return markPartial(out, ok.length < results.length);
  }

  async search(req: SearchRequest, signal?: AbortSignal): Promise<Itinerary[]> {
    const results = await Promise.allSettled(this.plan(req).map(async (args) => [await this.cachedCall(args, signal)]));
    return this.collect(results, req.currency);
  }

  /**
   * "Anywhere" search. Each call returns at most ~15 cities, cheapest first, so per departure window
   * a second page is fetched starting from the first page's highest price.
   */
  async explore(req: ExploreRequest, signal?: AbortSignal, pages = 2): Promise<Itinerary[]> {
    const results = await Promise.allSettled(
      this.explorePlan(req).map(async (args) => {
        const out: KiwiMcpResult[] = [];
        let cur = args;
        for (let p = 0; p < pages; p++) {
          const res = await this.cachedCall(cur, signal);
          out.push(res);
          const its = res.itineraries ?? [];
          if (its.length < 15) break;
          cur = { ...args, price_from: Math.floor(Math.max(...its.map((i) => i.price))) };
        }
        return out;
      }),
    );
    return this.collect(results, req.currency);
  }

  map(it: KiwiMcpItinerary, currency: string): Itinerary | null {
    try {
      const legs = [toLeg(it.outbound)];
      if (it.inbound) legs.push(toLeg(it.inbound));
      return finalize({
        id: `kiwi-${it.id}`,
        provider: this.id,
        providerName: this.name,
        legs,
        price: { amount: it.price, currency },
        deepLink: it.bookingUrl,
        imageUrl: it.imageId ? `https://images.kiwi.com/photos/600x600/${it.imageId}.jpg` : undefined,
        baggage: it.baggage
          ? { personalItem: it.baggage.personalItem ?? 0, cabinBag: it.baggage.cabinBag ?? 0, checkedBag: it.baggage.checkedBag ?? 0 }
          : undefined,
      });
    } catch {
      return null;
    }
  }
}

/** Local wall-clock ISO ("2026-11-21T08:55:00") → minutes since epoch as if it were UTC. */
const naive = (local: string) => Date.parse(`${local.slice(0, 16)}:00Z`) / 60000;

/**
 * Kiwi gives local times only. Absolute times are reconstructed from durations, so only one
 * airport's time zone is needed: the leg origin (or, failing that, the destination).
 * Each connection departs from the airport the previous segment landed at (same zone), so
 * the local difference between them equals the real layover.
 */
export function toLeg(l: KiwiLeg): Leg {
  const fromTz = getAirport(l.from)?.tz;
  const toTz = getAirport(l.to)?.tz;
  let legDepUtcMs: number;
  if (fromTz) legDepUtcMs = Date.parse(localToUtc(l.departureTime.slice(0, 16), fromTz));
  else if (toTz) legDepUtcMs = Date.parse(localToUtc(l.arrivalTime.slice(0, 16), toTz)) - l.durationSeconds * 1000;
  else legDepUtcMs = naive(l.departureTime) * 60000;

  const segments: Segment[] = [];
  let prevArrUtc = legDepUtcMs;
  let prevArrLocal = naive(l.departureTime);
  l.segments.forEach((s, i) => {
    const depUtc = i === 0 ? legDepUtcMs : prevArrUtc + (naive(s.departureTime) - prevArrLocal) * 60000;
    const durMin = s.durationSeconds ? Math.round(s.durationSeconds / 60) : Math.round((naive(s.arrivalTime) - naive(s.departureTime)) || 0);
    const arrUtc = depUtc + durMin * 60000;
    const m = /^([A-Z0-9]{2})\s?(\d+)$/.exec(s.flightNumber.trim());
    segments.push({
      from: s.from,
      to: s.to,
      departLocal: s.departureTime.slice(0, 16),
      arriveLocal: s.arrivalTime.slice(0, 16),
      departUtc: new Date(depUtc).toISOString(),
      arriveUtc: new Date(arrUtc).toISOString(),
      carrier: s.carrier || m?.[1] || "",
      carrierName: s.carrierName,
      flightNumber: m?.[2] ?? s.flightNumber,
      durationMin: durMin,
    });
    prevArrUtc = arrUtc;
    prevArrLocal = naive(s.arrivalTime);
  });
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    from: first.from,
    to: last.to,
    departLocal: first.departLocal,
    arriveLocal: last.arriveLocal,
    departUtc: first.departUtc,
    arriveUtc: new Date(legDepUtcMs + l.durationSeconds * 1000).toISOString(),
    durationMin: Math.round(l.durationSeconds / 60),
    stops: segments.length - 1,
    segments,
    toCity: l.segments[l.segments.length - 1]?.toCity,
    toCountry: l.segments[l.segments.length - 1]?.toCountry,
  };
}

export function clearKiwiMcpCache(): void {
  cache.clear();
}
