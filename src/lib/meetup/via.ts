import type { Airport, IATA, Itinerary, ProviderStatus, SearchRequest } from "@/lib/domain/types";
import { AIRPORTS, airportTz, distanceKm, getAirport } from "@/lib/data/airports";
import { utcToLocal } from "@/lib/domain/time";
import { fetchRaw, type AggregateOptions } from "@/lib/providers/aggregator";
import { matchesOneWay, mergeStatus, oneWayFilters } from "./engine";
import type { Friend, MeetupRequest, ViaFriend, ViaPlan, ViaResponse } from "./types";

/**
 * "Meet on the way": the friends fly to a hub, meet there and take one flight together to the destination.
 * Back home they either fly together to the hub and split there, or each flies home on their own; both are tried.
 */

/** Wait at the hub between the last friend landing and the shared flight. */
export const MIN_HUB_WAIT_MIN = 90;
export const MAX_HUB_WAIT_MIN = 12 * 60;
/** A hub may make nobody's trip longer than this, in straight-line distance. */
const MAX_DETOUR = 1.45;
/** The shared flight must be worth taking together. */
const MIN_SHARED_KM = 300;
/** Well-connected airports (many low-cost and network routes): a hub there is much more likely to have a shared flight. */
const BIG_HUBS = new Set(
  "LHR LGW STN LTN MAN DUB CDG ORY AMS BRU FRA MUC DUS HAM BER ZRH GVA VIE PRG BUD WAW KRK MXP BGY LIN FCO CIA NAP VCE BLQ PSA CTA PMO BCN MAD AGP PMI VLC ALC LIS OPO CPH ARN OSL HEL IST SAW ATH OTP SOF BEG RIX VNO TLL KRK GDN WRO KTW LYS NCE MRS EIN CRL BVA SKG TLV LCA".split(" "),
);
/** At most this many hubs per search, split across the destinations (each hub costs several provider requests). */
export const MAX_HUBS = 6;

const ms = (iso: string) => Date.parse(iso);
const dep = (it: Itinerary) => ms(it.legs[0].departUtc);
const arr = (it: Itinerary) => ms(it.legs[0].arriveUtc);
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Hubs on the way to `destination` for friends flying from `groups` (each friend's airports): big airports, or one of
 * the friends' own cities, that make nobody's trip much longer. Ordered by the total extra distance, one per city.
 */
export function suggestHubs(groups: IATA[][], destination: IATA, count = 3, all: Airport[] = AIRPORTS): IATA[] {
  const d = getAirport(destination);
  const people = groups.map((g) => g.map((i) => getAirport(i)).filter((a): a is Airport => Boolean(a))).filter((g) => g.length > 0);
  if (!d || people.length < 2) return [];
  const own = new Set(people.flat().map((a) => a.iata));
  const scored = all
    .filter((h) => (own.has(h.iata) || h.size === undefined || h.size === "large") && h.iata !== d.iata && !(h.city === d.city && h.country === d.country))
    .filter((h) => distanceKm(h, d) >= MIN_SHARED_KM)
    .map((h) => {
      let extra = 0;
      for (const g of people) {
        // Each friend uses whichever of their airports suits this hub best.
        const best = Math.min(...g.map((o) => (o.iata === h.iata ? 1 : (distanceKm(o, h) + distanceKm(h, d)) / Math.max(1, distanceKm(o, d)))));
        if (best > MAX_DETOUR) return null;
        extra += best;
      }
      return { h, extra: extra - (own.has(h.iata) ? 0.12 : 0) - (BIG_HUBS.has(h.iata) ? 0.25 : 0) };
    })
    .filter((x): x is { h: Airport; extra: number } => x !== null)
    .sort((a, b) => a.extra - b.extra);
  const cities = new Set<string>();
  const out: IATA[] = [];
  for (const { h } of scored) {
    const key = `${h.country}:${h.city}`;
    if (cities.has(key)) continue;
    cities.add(key);
    out.push(h.iata);
    if (out.length >= count) break;
  }
  return out;
}

/** Everything fetched for one destination and hub. Lists per friend hold their flights from all of their airports. */
export interface ViaSets {
  destination: IATA;
  hub: IATA;
  /** friend id → flights home → hub (empty for a friend who lives at the hub) */
  toHub: Map<string, Itinerary[]>;
  /** hub → destination, flown together */
  shared: Itinerary[];
  /** destination → hub, flown together on the way back */
  sharedBack: Itinerary[];
  /** friend id → hub → home */
  fromHub: Map<string, Itinerary[]>;
  /** friend id → destination → home, on their own */
  direct: Map<string, Itinerary[]>;
}

const cheapest = (list: Itinerary[], ok: (it: Itinerary) => boolean): Itinerary | null => {
  let best: Itinerary | null = null;
  for (const it of list) if (ok(it) && (!best || it.price.amount < best.price.amount)) best = it;
  return best;
};

/** Plans for one destination via one hub. Pure, for tests. */
export function planVia(req: MeetupRequest, sets: ViaSets): ViaPlan[] {
  const travellers = req.friends;
  const atHub = (f: Friend) => f.origins.includes(sets.hub);
  const homeOf = (f: Friend, it: Itinerary | null) => it?.legs[0].from ?? sets.hub;
  const plans: ViaPlan[] = [];
  const tz = airportTz(sets.destination);
  const seen = new Set<string>();

  for (const s of sets.shared) {
    const sDep = dep(s);
    // Each friend: the cheapest flight that lands at the hub in time for the shared flight.
    const outs = travellers.map((f) =>
      atHub(f) ? { f, it: null as Itinerary | null } : { f, it: cheapest(sets.toHub.get(f.id) ?? [], (it) => sDep - arr(it) >= MIN_HUB_WAIT_MIN * 60000 && sDep - arr(it) <= MAX_HUB_WAIT_MIN * 60000) },
    );
    if (outs.some((o) => !atHub(o.f) && !o.it)) continue;
    const lastLanding = Math.max(...outs.map((o) => (o.it ? arr(o.it) : sDep - MIN_HUB_WAIT_MIN * 60000)));
    const hubWait = Math.round((sDep - lastLanding) / 60000);
    const start = arr(s);
    const outPrice = outs.reduce((sum, o) => sum + (o.it?.price.amount ?? 0), 0) + s.price.amount * travellers.length;

    // Way back, together: shared flight to the hub, then each friend home from there.
    for (const r of sets.sharedBack) {
      if (dep(r) - start < 60 * 60000) continue;
      const homes = travellers.map((f) => {
        if (atHub(f)) return { f, it: null as Itinerary | null };
        const home = homeOf(f, outs.find((o) => o.f === f)!.it);
        return { f, it: cheapest((sets.fromHub.get(f.id) ?? []).filter((it) => it.legs[0].to === home), (it) => dep(it) - arr(r) >= MIN_HUB_WAIT_MIN * 60000 && dep(it) - arr(r) <= MAX_HUB_WAIT_MIN * 60000) };
      });
      if (homes.some((h) => !atHub(h.f) && !h.it)) continue;
      const price = outPrice + r.price.amount * travellers.length + homes.reduce((sum, h) => sum + (h.it?.price.amount ?? 0), 0);
      add(s, outs, hubWait, start, dep(r), price, "together", r, homes);
    }

    // Way back, each on their own, straight home from the destination.
    const directs = travellers.map((f) => ({ f, list: (sets.direct.get(f.id) ?? []).filter((it) => it.legs[0].to === homeOf(f, outs.find((o) => o.f === f)!.it) || atHub(f)) }));
    if (directs.every((d) => d.list.length)) {
      const ends = [...new Set(directs.flatMap((d) => d.list.map(dep)))].filter((t) => t - start >= 60 * 60000).sort((a, b) => a - b);
      for (const te of ends) {
        const homes = directs.map((d) => ({ f: d.f, it: cheapest(d.list, (it) => dep(it) >= te) }));
        if (homes.some((h) => !h.it)) break;
        const end = Math.min(...homes.map((h) => dep(h.it!)));
        const price = outPrice + homes.reduce((sum, h) => sum + h.it!.price.amount, 0);
        add(s, outs, hubWait, start, end, price, "separate", null, homes);
      }
    }
  }

  function add(
    s: Itinerary,
    outs: { f: Friend; it: Itinerary | null }[],
    hubWait: number,
    start: number,
    end: number,
    price: number,
    back: "together" | "separate",
    sharedBack: Itinerary | null,
    homes: { f: Friend; it: Itinerary | null }[],
  ) {
    const together = Math.round((end - start) / 60000);
    if (together < Math.max(60, (req.minTogetherHours ?? 0) * 60)) return;
    const key = [s.signature, sharedBack?.signature ?? "-", ...outs.map((o) => o.it?.signature ?? "-"), ...homes.map((h) => h.it?.signature ?? "-")].join("#");
    if (seen.has(key)) return;
    seen.add(key);
    const friends: ViaFriend[] = travellers.map((f, i) => {
      const toHub = outs[i].it;
      const home = homes[i].it;
      const own = (toHub?.price.amount ?? 0) + s.price.amount + (sharedBack?.price.amount ?? 0) + (home?.price.amount ?? 0);
      return { friend: f, toHub, home, price: round2(own) };
    });
    if (req.maxBudgetPerPerson !== undefined && friends.some((f) => f.price > req.maxBudgetPerPerson!)) return;
    plans.push({
      id: `via-${sets.destination}-${sets.hub}-${hashKey(key)}`,
      destination: sets.destination,
      hub: sets.hub,
      hubWaitMinutes: hubWait,
      shared: s,
      back,
      sharedBack,
      friends,
      togetherMinutes: together,
      totalPrice: Math.round(price),
      currency: req.currency,
      meetStartUtc: new Date(start).toISOString(),
      meetEndUtc: new Date(end).toISOString(),
      meetStartLocal: utcToLocal(start, tz),
      meetEndLocal: utcToLocal(end, tz),
      score: Math.round((together / 60) * req.valuePerHour - price),
    });
  }

  return plans.sort((a, b) => b.score - a.score || a.totalPrice - b.totalPrice);
}

function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Fetch flights for every destination and its hubs, then plan. Friends who live in a destination are left out there. */
export async function meetVia(req: MeetupRequest, opts: AggregateOptions = {}): Promise<ViaResponse> {
  const statuses = new Map<string, ProviderStatus>();
  const base = { adults: 1, cabin: req.cabin, currency: req.currency } as const;
  const cache = new Map<string, Promise<Itinerary[]>>();
  const get = (origin: IATA, destination: IATA, date: string, direction: "outbound" | "inbound" | "any") => {
    const key = `${origin}-${destination}-${date}-${direction}`;
    let p = cache.get(key);
    if (!p) {
      const filters = direction === "any" ? oneWayFilters(req.filters ? { ...req.filters, outbound: undefined, inbound: undefined } : undefined, "outbound") : oneWayFilters(req.filters, direction);
      const r: SearchRequest = { ...base, origin, destination, departDate: date, filters };
      p = fetchRaw(r, opts).then((res) => {
        for (const s of res.providers) mergeStatus(statuses, s);
        return res.raw.filter((it) => matchesOneWay(it, filters));
      });
      cache.set(key, p);
    }
    return p;
  };
  const pool = async (f: Friend, origins: IATA[], fn: (o: IATA) => Promise<Itinerary[]>) => (await Promise.all(origins.map(fn))).flat();

  const perDest = Math.max(1, Math.floor(MAX_HUBS / Math.max(1, req.destinations.length)));
  const hubsTried: ViaResponse["hubs"] = [];
  const all: ViaPlan[] = [];
  await Promise.all(
    req.destinations.map(async (destination) => {
      const friends = req.friends.filter((f) => !f.origins.includes(destination));
      if (friends.length < 2) return;
      const hubs = suggestHubs(friends.map((f) => f.origins), destination, perDest);
      hubsTried.push({ destination, hubs });
      const local = { ...req, friends };
      await Promise.all(
        hubs.map(async (hub) => {
          const away = (f: Friend) => f.origins.filter((o) => o !== hub);
          const sets: ViaSets = { destination, hub, toHub: new Map(), shared: [], sharedBack: [], fromHub: new Map(), direct: new Map() };
          await Promise.all([
            get(hub, destination, req.departDate, "any").then((x) => void (sets.shared = x)),
            get(destination, hub, req.returnDate, "inbound").then((x) => void (sets.sharedBack = x)),
            ...friends.map(async (f) => {
              const origins = f.origins.includes(hub) ? [] : away(f);
              const [to, from, direct] = await Promise.all([
                pool(f, origins, (o) => get(o, hub, req.departDate, "outbound")),
                pool(f, origins, (o) => get(hub, o, req.returnDate, "any")),
                pool(f, f.origins, (o) => get(destination, o, req.returnDate, "inbound")),
              ]);
              sets.toHub.set(f.id, to);
              sets.fromHub.set(f.id, from);
              sets.direct.set(f.id, direct);
            }),
          ]);
          all.push(...planVia(local, sets));
        }),
      );
    }),
  );

  all.sort((a, b) => b.score - a.score || a.totalPrice - b.totalPrice);
  // The best plan of each hub and of each way back, then the rest by score.
  const picked = new Map<string, ViaPlan>();
  for (const p of all) if (![...picked.values()].some((q) => q.hub === p.hub && q.destination === p.destination && q.back === p.back)) picked.set(p.id, p);
  for (const p of all) if (picked.size < (req.topK ?? 6)) picked.set(p.id, p);
  return {
    plans: [...picked.values()].sort((a, b) => b.score - a.score).slice(0, Math.max(req.topK ?? 6, 8)),
    hubs: hubsTried,
    providers: [...statuses.values()],
    generatedAt: new Date().toISOString(),
  };
}
