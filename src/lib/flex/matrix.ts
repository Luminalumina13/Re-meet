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

/**
 * Round-trip grid from one-way fares: every departure paired with every later (or same-day) return.
 * Pairs missing a fare on either side are left out. Prices are sums of one-way tickets, which can
 * differ from a true return fare, so the UI labels them as estimates.
 */
export function flexGrid(out: Map<string, number | null>, back: Map<string, number | null>): FlexCell[] {
  const cells: FlexCell[] = [];
  for (const [depart, po] of out) {
    if (po == null) continue;
    for (const [ret, pb] of back) {
      if (pb == null || ret < depart) continue;
      cells.push({ depart, ret, price: po + pb });
    }
  }
  return cells;
}

/** 0 for the cheapest price in the grid, 1 for the dearest; used to shade cells. */
export function priceRank(price: number, min: number, max: number): number {
  return max > min ? (price - min) / (max - min) : 0;
}
