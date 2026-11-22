import type { Itinerary } from "@/lib/domain/types";

/** Least time between landing and the next flight, so the next flight is realistically catchable. */
export const MIN_GAP_MS = 3 * 3600_000;
const PER_LEG = 12;

export interface Chain {
  /** One itinerary per leg, in travel order. */
  flights: Itinerary[];
  total: number;
}

const dep = (it: Itinerary) => Date.parse(it.legs[0].departUtc);
const arr = (it: Itinerary) => Date.parse(it.legs[0].arriveUtc);

/**
 * Cheapest ways to fly several one-way legs in a row. Each leg keeps its PER_LEG cheapest fares; a flight may follow
 * another only when it leaves at least MIN_GAP_MS after that one lands. Returns the best chains, each ending in a
 * different last flight and each flight used once.
 */
export function bestChains(legs: Itinerary[][], limit = 5): Chain[] {
  if (legs.length === 0 || legs.some((l) => l.length === 0)) return [];
  const cut = legs.map((l) => l.slice().sort((a, b) => a.price.amount - b.price.amount).slice(0, PER_LEG));
  let layer: Chain[] = cut[0].map((it) => ({ flights: [it], total: it.price.amount }));
  for (let k = 1; k < cut.length; k++) {
    const next: Chain[] = [];
    for (const it of cut[k]) {
      let best: Chain | null = null;
      for (const c of layer) {
        if (dep(it) - arr(c.flights[c.flights.length - 1]) < MIN_GAP_MS) continue;
        if (!best || c.total < best.total) best = c;
      }
      if (best) next.push({ flights: [...best.flights, it], total: best.total + it.price.amount });
    }
    layer = next;
  }
  layer.sort((a, b) => a.total - b.total);
  const used = new Set<string>();
  const picked: Chain[] = [];
  for (const c of layer) {
    if (c.flights.some((f) => used.has(f.signature))) continue;
    c.flights.forEach((f) => used.add(f.signature));
    picked.push(c);
    if (picked.length >= limit) break;
  }
  return picked;
}
