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

interface FriendOptions {
  friend: Friend;
  host: boolean;
  out: Indexed;
  back: Indexed;
}

export interface CandidateSets {
  /** per friend: outbound one-way itineraries (already filtered) */
  outbound: Map<string, Itinerary[]>;
  inbound: Map<string, Itinerary[]>;
}

const ms = (iso: string) => Date.parse(iso);

/** Pure planner over pre-fetched candidates — easy to unit test. */
export function planMeetup(
  req: MeetupRequest,
  destination: string,
  sets: CandidateSets,
): { plans: MeetupPlan[]; unreachable: MeetupResponse["unreachable"] } {
  const unreachable: MeetupResponse["unreachable"] = [];
  const opts: FriendOptions[] = req.friends.map((friend) => {
    const host = friend.origin === destination;
    const o = host ? [] : (sets.outbound.get(friend.id) ?? []);
    const b = host ? [] : (sets.inbound.get(friend.id) ?? []);
    if (!host && !o.length) unreachable.push({ destination, friendId: friend.id, direction: "outbound" });
    if (!host && !b.length) unreachable.push({ destination, friendId: friend.id, direction: "inbound" });
    return {
      friend,
      host,
      out: indexPrefix(o, (it) => ms(it.legs[0].arriveUtc)),
      back: indexSuffix(b, (it) => ms(it.legs[0].departUtc)),
    };
  });
  if (unreachable.length) return { plans: [], unreachable };
  const travellers = opts.filter((o) => !o.host);
  if (!travellers.length) return { plans: [], unreachable };

  const starts = [...new Set(travellers.flatMap((o) => o.out.items.map((x) => x.key)))].sort((a, b) => a - b);
  const ends = [...new Set(travellers.flatMap((o) => o.back.items.map((x) => x.key)))].sort((a, b) => a - b);
  const minTogether = (req.minTogetherHours ?? 0) * 60;
  const tz = airportTz(destination);
  const seen = new Set<string>();
  const plans: MeetupPlan[] = [];

  for (const ts of starts) {
    // Outbound choice depends only on ts — resolve once per ts.
    const outs: (Itinerary | null)[] = travellers.map((o) => cheapestAtOrBefore(o.out, ts));
    if (outs.some((x) => !x)) continue;
    if (req.maxBudgetPerPerson !== undefined && outs.some((x) => x!.price.amount > req.maxBudgetPerPerson!)) continue;
    const outPrice = outs.reduce((s, x) => s + x!.price.amount, 0);

    for (const te of ends) {
      const together = Math.round((te - ts) / 60000);
      if (together < Math.max(60, minTogether)) continue;
      const backs = travellers.map((o) => cheapestAtOrAfter(o.back, te));
      if (backs.some((x) => !x)) break; // later te only gets harder
      if (
        req.maxBudgetPerPerson !== undefined &&
        travellers.some((_, i) => outs[i]!.price.amount + backs[i]!.price.amount > req.maxBudgetPerPerson!)
      )
        continue;
      const total = outPrice + backs.reduce((s, x) => s + x!.price.amount, 0);
      const key = travellers.map((_, i) => `${outs[i]!.signature}~${backs[i]!.signature}`).join("#");
      if (seen.has(key)) continue;
      seen.add(key);

      // Actual meeting window is defined by the chosen flights, not the probe values.
      const realStart = Math.max(...outs.map((x) => ms(x!.legs[0].arriveUtc)));
      const realEnd = Math.min(...backs.map((x) => ms(x!.legs[0].departUtc)));
      const realTogether = Math.round((realEnd - realStart) / 60000);
      const friends: FriendPlan[] = opts.map((o) => {
        if (o.host) return { friend: o.friend, outbound: null, inbound: null, arriveUtc: null, departUtc: null, price: 0 };
        const i = travellers.indexOf(o);
        const ob = outs[i]!;
        const ib = backs[i]!;
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

function oneWayFilters(f: SearchFilters | undefined, direction: "outbound" | "inbound"): SearchFilters | undefined {
  if (!f) return undefined;
  // For one-way searches the only leg is legs[0]; apply the matching window to it.
  return { maxStops: f.maxStops, maxPrice: f.maxPrice, carriers: f.carriers, outbound: direction === "outbound" ? f.outbound : f.inbound };
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
        .filter((f) => f.origin !== destination)
        .map(async (f) => {
          const base = { adults: 1, cabin: req.cabin, currency: req.currency } as const;
          const outReq: SearchRequest = { ...base, origin: f.origin, destination, departDate: req.departDate, filters: oneWayFilters(req.filters, "outbound") };
          const backReq: SearchRequest = { ...base, origin: destination, destination: f.origin, departDate: req.returnDate, filters: oneWayFilters(req.filters, "inbound") };
          const [o, b] = await Promise.all([fetchRaw(outReq, opts), fetchRaw(backReq, opts)]);
          for (const s of [...o.providers, ...b.providers]) statuses.set(s.id, s);
          sets.outbound.set(f.id, o.raw.filter((it) => matchesOneWay(it, outReq.filters)));
          sets.inbound.set(f.id, b.raw.filter((it) => matchesOneWay(it, backReq.filters)));
        }),
    );
    const res = planMeetup(req, destination, sets);
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

function matchesOneWay(it: Itinerary, f?: SearchFilters): boolean {
  if (!f) return true;
  const leg = it.legs[0];
  if (f.maxStops !== undefined && leg.stops > f.maxStops) return false;
  if (f.maxPrice !== undefined && it.price.amount > f.maxPrice) return false;
  if (f.carriers?.length && !leg.segments.every((s) => f.carriers!.includes(s.carrier))) return false;
  return legMatchesWindow(leg, f.outbound);
}
