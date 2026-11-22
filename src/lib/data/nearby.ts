import type { Airport, IATA } from "@/lib/domain/types";
import { AIRPORTS, distanceKm, getAirport } from "./airports";

/** How far from the chosen airport to look for more: radius in km, or every big airport of its country. */
export type Spread = 0 | 100 | 200 | 300 | "country";
export const SPREADS: Spread[] = [0, 100, 200, 300, "country"];
/** Most airports one side may grow to, and most airport pairs one search may send to the providers. */
export const MAX_PER_SIDE = 3;
export const MAX_PAIRS = 8;

const rank = (a: Airport) => (a.size === "medium" ? 1 : a.size === "small" ? 2 : 0);

/** The chosen airport first, then the nearest worthwhile ones (large and medium; never small strips). */
export function expandAirport(iata: IATA, spread: Spread, max = MAX_PER_SIDE, all: Airport[] = AIRPORTS): IATA[] {
  const base = getAirport(iata);
  if (!base || spread === 0) return [iata];
  const pool = all.filter((a) => a.iata !== base.iata && a.size !== "small");
  let picked: Airport[];
  if (spread === "country") {
    picked = pool.filter((a) => a.country === base.country).sort((a, b) => rank(a) - rank(b) || distanceKm(base, a) - distanceKm(base, b));
  } else {
    picked = pool.filter((a) => distanceKm(base, a) <= spread).sort((a, b) => distanceKm(base, a) - distanceKm(base, b));
  }
  return [iata, ...picked.slice(0, Math.max(0, max - 1)).map((a) => a.iata)];
}

/** Origin × destination airport pairs, the chosen pair first, capped so a search stays quick. */
export function airportPairs(origin: IATA, destination: IATA, oSpread: Spread, dSpread: Spread, cap = MAX_PAIRS, all: Airport[] = AIRPORTS): [IATA, IATA][] {
  const os = expandAirport(origin, oSpread, MAX_PER_SIDE, all);
  const ds = expandAirport(destination, dSpread, MAX_PER_SIDE, all);
  const pairs: [IATA, IATA, number][] = [];
  os.forEach((o, i) => ds.forEach((d, j) => o !== d && pairs.push([o, d, i + j])));
  return pairs.sort((x, y) => x[2] - y[2]).slice(0, cap).map(([o, d]) => [o, d]);
}

const MAX_MEET_KM = 3000;

/**
 * Fair meeting airports for friends who fly from different places: the large airports where the friend with the
 * longest trip has the shortest one (straight-line), one per city. The friends' own cities may come up too. `groups` holds each friend's airports.
 */
export function suggestMeetingAirports(groups: IATA[][], count = 4, all: Airport[] = AIRPORTS): IATA[] {
  const people = groups.map((g) => g.map((i) => getAirport(i)).filter((a): a is Airport => Boolean(a))).filter((g) => g.length > 0);
  if (people.length < 2) return [];
  const scored = all
    .filter((a) => a.size === undefined || a.size === "large")
    .map((a) => {
      const ds = people.map((g) => Math.min(...g.map((h) => distanceKm(h, a))));
      return { a, worst: Math.max(...ds), sum: ds.reduce((s, x) => s + x, 0) };
    })
    .filter((x) => x.worst <= MAX_MEET_KM)
    .sort((x, y) => x.worst - y.worst || x.sum - y.sum);
  const cities = new Set<string>();
  const out: IATA[] = [];
  for (const { a } of scored) {
    const key = `${a.country}:${a.city}`;
    if (cities.has(key)) continue;
    cities.add(key);
    out.push(a.iata);
    if (out.length >= count) break;
  }
  return out;
}
