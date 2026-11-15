import type {
  ComfortBreakdown,
  Itinerary,
  Leg,
  ScoredItinerary,
  SearchFilters,
  TimeWindow,
} from "./types";
import { hhmmToMinutes, localMinutes } from "./time";

/** Default "ideal weekend" windows: leave after breakfast, come back in the evening. */
export const IDEAL_WEEKEND_FILTERS: SearchFilters = {
  outbound: { departAfter: "08:00" },
  inbound: { arriveAfter: "17:00", arriveBefore: "23:30" },
};

export function legMatchesWindow(leg: Leg, w?: TimeWindow): boolean {
  if (!w) return true;
  // Arrival bounds are wall-clock times on the day of departure: landing on a later day fails them.
  if ((w.arriveAfter || w.arriveBefore) && leg.arriveLocal.slice(0, 10) !== leg.departLocal.slice(0, 10)) return false;
  const dep = localMinutes(leg.departLocal);
  const arr = localMinutes(leg.arriveLocal);
  if (w.departAfter && dep < hhmmToMinutes(w.departAfter)) return false;
  if (w.departBefore && dep > hhmmToMinutes(w.departBefore)) return false;
  if (w.arriveAfter && arr < hhmmToMinutes(w.arriveAfter)) return false;
  if (w.arriveBefore && arr > hhmmToMinutes(w.arriveBefore)) return false;
  return true;
}

export function itineraryMatches(it: Itinerary, f?: SearchFilters): boolean {
  if (!f) return true;
  const [out, back] = it.legs;
  if (f.maxStops !== undefined && it.legs.some((l) => l.stops > f.maxStops!)) return false;
  if (f.maxDurationMin !== undefined && it.legs.some((l) => l.durationMin > f.maxDurationMin!)) return false;
  if (f.maxPrice !== undefined && it.price.amount > f.maxPrice) return false;
  if (f.carriers && f.carriers.length) {
    const ok = it.legs.every((l) => l.segments.every((s) => f.carriers!.includes(s.carrier)));
    if (!ok) return false;
  }
  if (out && !legMatchesWindow(out, f.outbound)) return false;
  if (back && !legMatchesWindow(back, f.inbound)) return false;
  return true;
}

export function applyFilters(list: Itinerary[], f?: SearchFilters): Itinerary[] {
  return list.filter((it) => itineraryMatches(it, f));
}

/**
 * Soft fit of a minute-of-day against a window: 1 inside, decaying to 0 at 3h outside.
 */
function windowFit(min: number, after?: string, before?: string): number {
  let dist = 0;
  if (after !== undefined) dist = Math.max(dist, hhmmToMinutes(after) - min);
  if (before !== undefined) dist = Math.max(dist, min - hhmmToMinutes(before));
  if (dist <= 0) return 1;
  return Math.max(0, 1 - dist / 180);
}

export function comfortOf(it: Itinerary, f: SearchFilters = IDEAL_WEEKEND_FILTERS): ComfortBreakdown {
  const [out, back] = it.legs;
  const ow = f.outbound ?? {};
  const iw = f.inbound ?? {};
  let outboundDeparture = out ? windowFit(localMinutes(out.departLocal), ow.departAfter, ow.departBefore) : 1;
  // Landing after midnight (next local day) eats the first night: halve the outbound fit.
  if (out && out.arriveLocal.slice(0, 10) !== out.departLocal.slice(0, 10)) outboundDeparture *= 0.5;
  const inboundArrival = back ? windowFit(localMinutes(back.arriveLocal), iw.arriveAfter, iw.arriveBefore) : 1;
  const stops = it.legs.reduce((s, l) => s + l.stops, 0);
  const directness = Math.max(0, 1 - stops * 0.45);
  const total = it.legs.reduce((s, l) => s + l.durationMin, 0);
  const flying = it.legs.reduce((s, l) => s + l.segments.reduce((x, g) => x + g.durationMin, 0), 0);
  // ratio of pure flying time to total elapsed time — layovers hurt
  const speed = total > 0 ? Math.min(1, flying / total) : 1;
  return { outboundDeparture, inboundArrival, directness, speed };
}

export function comfortScore(b: ComfortBreakdown): number {
  const v = b.outboundDeparture * 0.35 + b.inboundArrival * 0.35 + b.directness * 0.2 + b.speed * 0.1;
  return Math.round(v * 100);
}

export function badgesOf(it: Itinerary): string[] {
  const badges: string[] = [];
  const [out, back] = it.legs;
  if (out && localMinutes(out.departLocal) >= hhmmToMinutes("08:00") && localMinutes(out.departLocal) < hhmmToMinutes("12:00")) {
    badges.push("morning-departure");
  }
  if (back && localMinutes(back.arriveLocal) >= hhmmToMinutes("17:00") && localMinutes(back.arriveLocal) <= hhmmToMinutes("23:30")) {
    badges.push("evening-return");
  }
  if (it.legs.every((l) => l.stops === 0)) badges.push("direct");
  return badges;
}

/**
 * Rank: higher is better. Normalises price against the cheapest option in the set so
 * that a 20 % cheaper ticket is worth roughly as much as +20 comfort points.
 */
export function scoreAll(list: Itinerary[], f?: SearchFilters): ScoredItinerary[] {
  if (!list.length) return [];
  const minPrice = Math.min(...list.map((i) => i.price.amount));
  return list.map((it) => {
    const comfortBreakdown = comfortOf(it, f);
    const comfort = comfortScore(comfortBreakdown);
    const priceRatio = it.price.amount / Math.max(1, minPrice); // 1 = cheapest
    const pricePts = Math.max(0, 100 - (priceRatio - 1) * 100);
    const rank = Math.round(comfort * 0.55 + pricePts * 0.45);
    return { ...it, comfort, comfortBreakdown, rank, badges: badgesOf(it) };
  });
}

export type SortKey = "best" | "cheapest" | "fastest" | "comfort";

export function sortItineraries(list: ScoredItinerary[], key: SortKey): ScoredItinerary[] {
  const copy = [...list];
  const dur = (i: Itinerary) => i.legs.reduce((s, l) => s + l.durationMin, 0);
  switch (key) {
    case "cheapest":
      return copy.sort((a, b) => a.price.amount - b.price.amount || dur(a) - dur(b));
    case "fastest":
      return copy.sort((a, b) => dur(a) - dur(b) || a.price.amount - b.price.amount);
    case "comfort":
      return copy.sort((a, b) => b.comfort - a.comfort || a.price.amount - b.price.amount);
    default:
      return copy.sort((a, b) => b.rank - a.rank || a.price.amount - b.price.amount);
  }
}
