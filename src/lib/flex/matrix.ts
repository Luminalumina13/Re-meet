import { addDays } from "@/lib/domain/time";

/** `days` dates either side of `center`, oldest first, without dates before `notBefore`. */
export function flexDates(center: string, days: number, notBefore?: string): string[] {
  const out: string[] = [];
  for (let i = -days; i <= days; i++) {
    const d = addDays(center, i);
    if (!notBefore || d >= notBefore) out.push(d);
  }
  return out;
}

export interface FlexCell {
  depart: string;
  ret: string;
  /** Sum of the two one-way fares. */
  price: number;
}

/** Buffer between landing and the return take-off for a pair to count as a trip (not a wish about trip length). */
export const MIN_STAY_MIN = 3 * 60;

interface Timed {
  price: number;
  departUtc: string;
  arriveUtc: string;
}

/**
 * Round-trip grid from one-way fares. A pair counts only if the return flight leaves at least
 * `minStayMin` after the outbound lands; for each pair the cheapest such combination wins.
 * Prices are sums of one-way tickets, which can differ from a true return fare, so the UI labels
 * them as estimates.
 */
export function flexGrid(out: Map<string, Timed[]>, back: Map<string, Timed[]>, minStayMin = MIN_STAY_MIN): FlexCell[] {
  const cells: FlexCell[] = [];
  for (const [depart, outs] of out) {
    for (const [ret, backs] of back) {
      if (ret < depart) continue;
      let best: number | null = null;
      for (const o of outs) {
        for (const b of backs) {
          if (Date.parse(b.departUtc) - Date.parse(o.arriveUtc) < minStayMin * 60_000) continue;
          const sum = o.price + b.price;
          if (best === null || sum < best) best = sum;
        }
      }
      if (best !== null) cells.push({ depart, ret, price: Math.round(best) });
    }
  }
  return cells;
}

/** 0 for the cheapest price in the grid, 1 for the dearest; used to shade cells. */
export function priceRank(price: number, min: number, max: number): number {
  return max > min ? (price - min) / (max - min) : 0;
}
