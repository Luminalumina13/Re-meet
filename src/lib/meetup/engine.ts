import type { Itinerary, ProviderStatus, SearchFilters, SearchRequest } from "@/lib/domain/types";
import { legMatchesWindow } from "@/lib/domain/filters";
import { airportTz } from "@/lib/data/airports";
import { utcToLocal } from "@/lib/domain/time";
import { fetchRaw, type AggregateOptions } from "@/lib/providers/aggregator";
import type { Friend, FriendPlan, MeetupPlan, MeetupRequest, MeetupResponse } from "./types";

/**
 * Picks one outbound + one return flight per friend so that the time everyone is in the
 * destination at once is maximal, balanced against total price.
 *
 * Time together = min(return departure) − max(arrival).
 * For a fixed pair (T_start, T_end) each friend independently takes the cheapest outbound
 * arriving ≤ T_start and the cheapest return departing ≥ T_end, so the search space is just
 * the set of candidate (T_start, T_end) pairs — tiny, and exact.
 */

interface Indexed {
  /** sorted ascending by `key` */
  items: { key: number; it: Itinerary }[];
  /** best[i] = cheapest itinerary among items[0..i] (prefix) or items[i..] (suffix) */
  best: Itinerary[];
}

function indexPrefix(list: Itinerary[], key: (it: Itinerary) => number): Indexed {
  const items = list.map((it) => ({ key: key(it), it })).sort((a, b) => a.key - b.key);
  const best: Itinerary[] = [];
  let cur: Itinerary | null = null;
  for (const { it } of items) {
    if (!cur || it.price.amount < cur.price.amount) cur = it;
    best.push(cur);
  }
  return { items, best };
}

function indexSuffix(list: Itinerary[], key: (it: Itinerary) => number): Indexed {
  const items = list.map((it) => ({ key: key(it), it })).sort((a, b) => a.key - b.key);
  const best: Itinerary[] = new Array(items.length);
  let cur: Itinerary | null = null;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i].it;
    if (!cur || it.price.amount < cur.price.amount) cur = it;
    best[i] = cur;
  }
  return { items, best };
}

/** Cheapest item with key <= t, or null. */
function cheapestAtOrBefore(ix: Indexed, t: number): Itinerary | null {
  let lo = 0;
  let hi = ix.items.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ix.items[mid].key <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans >= 0 ? ix.best[ans] : null;
}

/** Cheapest item with key >= t, or null. */
function cheapestAtOrAfter(ix: Indexed, t: number): Itinerary | null {
  let lo = 0;
  let hi = ix.items.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ix.items[mid].key >= t) {
      ans = mid;
      hi = mid - 1;
    } else lo = mid + 1;
  }
  return ans >= 0 ? ix.best[ans] : null;
}

/** One airport a friend can fly from: both directions must use it, so they get home to their car. */
interface Route {
  origin: string;
  out: Indexed;
  back: Indexed;
}

interface FriendOptions {
  friend: Friend;
  host: boolean;
  routes: Route[];
}

function groupBy(list: Itinerary[], airport: (it: Itinerary) => string): Map<string, Itinerary[]> {
  const m = new Map<string, Itinerary[]>();
  for (const it of list) {
    const k = airport(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/** Cheapest round trip for this friend that arrives by `ts` and leaves no earlier than `te`, over all their airports. */
function bestRoute(o: FriendOptions, ts: number, te: number, budget?: number): { ob: Itinerary; ib: Itinerary; total: number } | null {
  let best: { ob: Itinerary; ib: Itinerary; total: number } | null = null;
  for (const r of o.routes) {
    const ob = cheapestAtOrBefore(r.out, ts);
    const ib = cheapestAtOrAfter(r.back, te);
    if (!ob || !ib) continue;
    const total = ob.price.amount + ib.price.amount;
    if (budget !== undefined && total > budget) continue;
    if (!best || total < best.total) best = { ob, ib, total };
  }
  return best;
}

export interface CandidateSets {
  /** per friend: outbound one-way itineraries (already filtered) */
  outbound: Map<string, Itinerary[]>;
  inbound: Map<string, Itinerary[]>;
}

const ms = (iso: string) => Date.parse(iso);

type PlanResult = { plans: MeetupPlan[]; unreachable: MeetupResponse["unreachable"] };

/** Pure planner over pre-fetched candidates — easy to unit test. */
export function planMeetup(req: MeetupRequest, destination: string, sets: CandidateSets): PlanResult {
  const g = planSteps(req, destination, sets);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

/** Same planner, but hands the event loop back every few milliseconds so a big grid cannot block the server. */
export async function planMeetupAsync(req: MeetupRequest, destination: string, sets: CandidateSets): Promise<PlanResult> {
  const g = planSteps(req, destination, sets);
  let sliceStart = Date.now();
  let r = g.next();
  while (!r.done) {
    if (Date.now() - sliceStart > 8) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      sliceStart = Date.now();
    }
    r = g.next();
  }
  return r.value;
}

/** Statuses of repeated requests to one provider are combined, so one failure is not hidden by later successes. */
export function mergeStatus(map: Map<string, ProviderStatus>, s: ProviderStatus): void {
  const cur = map.get(s.id);
  if (!cur) {
    map.set(s.id, { ...s });
    return;
  }
  const rank = { error: 2, ok: 1, skipped: 0 } as const;
  map.set(s.id, {
    ...cur,
    status: rank[s.status] > rank[cur.status] ? s.status : cur.status,
    count: cur.count + s.count,
    ms: Math.max(cur.ms, s.ms),
    error: cur.error ?? s.error,
  });
}

function* planSteps(req: MeetupRequest, destination: string, sets: CandidateSets): Generator<void, PlanResult> {
  const unreachable: MeetupResponse["unreachable"] = [];
  const opts: FriendOptions[] = req.friends.map((friend) => {
    const host = friend.origins.includes(destination);
    const o = host ? [] : (sets.outbound.get(friend.id) ?? []);
    const b = host ? [] : (sets.inbound.get(friend.id) ?? []);
    const outBy = groupBy(o, (it) => it.legs[0].from);
    const backBy = groupBy(b, (it) => it.legs[0].to);
    const routes: Route[] = [];
    for (const [origin, outs] of outBy) {
      const backs = backBy.get(origin);
      if (backs) routes.push({ origin, out: indexPrefix(outs, (it) => ms(it.legs[0].arriveUtc)), back: indexSuffix(backs, (it) => ms(it.legs[0].departUtc)) });
    }
    if (!host) {
      if (!o.length || !routes.length) unreachable.push({ destination, friendId: friend.id, direction: "outbound" });
      if (!b.length || !routes.length) unreachable.push({ destination, friendId: friend.id, direction: "inbound" });
    }
    return { friend, host, routes };
  });
  if (unreachable.length) return { plans: [], unreachable };
  const travellers = opts.filter((o) => !o.host);
  if (!travellers.length) return { plans: [], unreachable };

  const starts = [...new Set(travellers.flatMap((o) => o.routes.flatMap((r) => r.out.items.map((x) => x.key))))].sort((a, b) => a - b);
  const ends = [...new Set(travellers.flatMap((o) => o.routes.flatMap((r) => r.back.items.map((x) => x.key))))].sort((a, b) => a - b);
  const minTogether = (req.minTogetherHours ?? 0) * 60;
  const tz = airportTz(destination);
  const seen = new Set<string>();
  const plans: MeetupPlan[] = [];

  for (const ts of starts) {
    yield;
    for (const te of ends) {
      const together = Math.round((te - ts) / 60000);
      if (together < Math.max(60, minTogether)) continue;
      const picks = travellers.map((o) => bestRoute(o, ts, te, req.maxBudgetPerPerson));
      // Feasibility only shrinks as the end time moves later, so stop for this start.
      if (picks.some((x) => !x)) break;
      const outs = picks.map((x) => x!.ob);
      const backs = picks.map((x) => x!.ib);
      const total = picks.reduce((s, x) => s + x!.total, 0);
      const key = travellers.map((_, i) => `${outs[i].signature}~${backs[i].signature}`).join("#");
      if (seen.has(key)) continue;
      seen.add(key);

      // Actual meeting window is defined by the chosen flights, not the probe values.
      const realStart = Math.max(...outs.map((x) => ms(x.legs[0].arriveUtc)));
      const realEnd = Math.min(...backs.map((x) => ms(x.legs[0].departUtc)));
      const realTogether = Math.round((realEnd - realStart) / 60000);
      const friends: FriendPlan[] = opts.map((o) => {
        if (o.host) return { friend: o.friend, outbound: null, inbound: null, arriveUtc: null, departUtc: null, price: 0 };
        const i = travellers.indexOf(o);
        const ob = outs[i];
        const ib = backs[i];
        return {
          friend: o.friend,
          outbound: ob,
          inbound: ib,
          arriveUtc: ob.legs[0].arriveUtc,
          departUtc: ib.legs[0].departUtc,
          price: Math.round((ob.price.amount + ib.price.amount) * 100) / 100,
        };
      });
      plans.push({
        id: `${destination}-${hashKey(key)}`,
        destination,
        togetherMinutes: realTogether,
        totalPrice: Math.round(total),
        currency: req.currency,
        meetStartUtc: new Date(realStart).toISOString(),
        meetEndUtc: new Date(realEnd).toISOString(),
        meetStartLocal: utcToLocal(realStart, tz),
        meetEndLocal: utcToLocal(realEnd, tz),
        friends,
        score: Math.round((realTogether / 60) * req.valuePerHour - total),
      });
    }
  }
  plans.sort((a, b) => b.score - a.score || a.totalPrice - b.totalPrice);
  return { plans, unreachable };
}

export function paretoFrontier(plans: MeetupPlan[]): MeetupResponse["frontier"] {
  const sorted = [...plans].sort((a, b) => b.togetherMinutes - a.togetherMinutes || a.totalPrice - b.totalPrice);
  const out: MeetupResponse["frontier"] = [];
  let bestPrice = Infinity;
  for (const p of sorted) {
    if (p.totalPrice < bestPrice) {
      bestPrice = p.totalPrice;
      out.push({ planId: p.id, destination: p.destination, togetherMinutes: p.togetherMinutes, totalPrice: p.totalPrice });
    }
  }
  return out.sort((a, b) => a.totalPrice - b.totalPrice);
}

function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function oneWayFilters(f: SearchFilters | undefined, direction: "outbound" | "inbound"): SearchFilters | undefined {
  if (!f) return undefined;
  // For one-way searches the only leg is legs[0]; apply the matching window to it.
  return { maxStops: f.maxStops, maxPrice: f.maxPrice, carriers: f.carriers, maxDurationMin: f.maxDurationMin, outbound: direction === "outbound" ? f.outbound : f.inbound };
}

/** Fetch candidates for every friend and destination, then plan. */
export async function meetup(req: MeetupRequest, opts: AggregateOptions = {}): Promise<MeetupResponse> {
  const statuses = new Map<string, ProviderStatus>();
  const allPlans: MeetupPlan[] = [];
  const unreachable: MeetupResponse["unreachable"] = [];
  const topK = req.topK ?? 6;

  // Destinations are independent: fetch and plan them in parallel.
  await Promise.all(req.destinations.map(async (destination) => {
    const sets: CandidateSets = { outbound: new Map(), inbound: new Map() };
    await Promise.all(
      req.friends
        .filter((f) => !f.origins.includes(destination))
        .flatMap((f) =>
          f.origins.map(async (origin) => {
            const base = { adults: 1, cabin: req.cabin, currency: req.currency } as const;
            const outReq: SearchRequest = { ...base, origin, destination, departDate: req.departDate, filters: oneWayFilters(req.filters, "outbound") };
            const backReq: SearchRequest = { ...base, origin: destination, destination: origin, departDate: req.returnDate, filters: oneWayFilters(req.filters, "inbound") };
            const [o, b] = await Promise.all([fetchRaw(outReq, opts), fetchRaw(backReq, opts)]);
            for (const s of [...o.providers, ...b.providers]) mergeStatus(statuses, s);
            // A friend's airports are searched in parallel; pool the results per friend.
            sets.outbound.set(f.id, [...(sets.outbound.get(f.id) ?? []), ...o.raw.filter((it) => matchesOneWay(it, outReq.filters))]);
            sets.inbound.set(f.id, [...(sets.inbound.get(f.id) ?? []), ...b.raw.filter((it) => matchesOneWay(it, backReq.filters))]);
          }),
        ),
    );
    const res = await planMeetupAsync(req, destination, sets);
    allPlans.push(...res.plans);
    unreachable.push(...res.unreachable);
  }));

  allPlans.sort((a, b) => b.score - a.score || a.totalPrice - b.totalPrice);
  const frontier = paretoFrontier(allPlans);
  // Always surface the best plan per destination and the frontier (cheapest / longest),
  // even when they are not top-scored overall.
  const picked = new Map<string, MeetupPlan>();
  for (const p of allPlans.slice(0, topK)) picked.set(p.id, p);
  for (const destination of req.destinations) {
    const best = allPlans.find((p) => p.destination === destination);
    if (best) picked.set(best.id, best);
  }
  for (const f of frontier) {
    const p = allPlans.find((x) => x.id === f.planId);
    if (p && picked.size < topK + 6) picked.set(p.id, p);
  }
  return {
    request: req,
    plans: [...picked.values()].sort((a, b) => b.score - a.score),
    frontier,
    providers: [...statuses.values()],
    unreachable,
    generatedAt: new Date().toISOString(),
  };
}

export function matchesOneWay(it: Itinerary, f?: SearchFilters): boolean {
  if (!f) return true;
  const leg = it.legs[0];
  if (f.maxStops !== undefined && leg.stops > f.maxStops) return false;
  if (f.maxDurationMin !== undefined && leg.durationMin > f.maxDurationMin) return false;
  if (f.maxPrice !== undefined && it.price.amount > f.maxPrice) return false;
  if (f.carriers?.length && !leg.segments.every((s) => f.carriers!.includes(s.carrier))) return false;
  return legMatchesWindow(leg, f.outbound);
}
