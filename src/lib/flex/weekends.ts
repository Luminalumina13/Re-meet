import { addDays } from "@/lib/domain/time";
import { upcomingWeekends, type WeekendShape } from "@/lib/domain/dates";
import { flexGrid, type Timed } from "./matrix";

/** One candidate trip: a weekend of the given shape. */
export interface WeekendTrip {
  saturday: string;
  shape: WeekendShape;
  departDate: string;
  returnDate: string;
}

export interface RankedTrip extends WeekendTrip {
  /** Sum of the cheapest feasible pair of one-way fares. */
  price: number;
}

/** The next `count` weekends in each chosen shape; trips that would leave today or earlier are dropped. */
export function weekendTrips(today: string, count: number, shapes: WeekendShape[]): WeekendTrip[] {
  const out: WeekendTrip[] = [];
  for (const shape of shapes) {
    // A Friday or Thursday departure can fall on a day that has already started, so look one weekend further.
    for (const w of upcomingWeekends(today, count + 1, shape)) {
      if (w.departDate > today) out.push(w);
    }
  }
  const seen = new Set<string>();
  const unique = out.filter((t) => {
    const k = `${t.departDate}|${t.returnDate}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
  // `count` weekends per shape, in date order.
  return unique.sort((a, b) => a.departDate.localeCompare(b.departDate) || a.returnDate.localeCompare(b.returnDate)).filter((t, _, all) => {
    const firstSat = all.reduce((m, x) => (x.saturday < m ? x.saturday : m), all[0].saturday);
    return t.saturday < addDays(firstSat, 7 * count);
  });
}

/** Every outbound and return day that has to be priced, sorted and without repeats. */
export function neededDays(trips: WeekendTrip[]): { out: string[]; back: string[] } {
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  return { out: uniq(trips.map((t) => t.departDate)), back: uniq(trips.map((t) => t.returnDate)) };
}

/** Prices every trip from per-day one-way fares and returns them cheapest first; trips with no feasible pair are left out. */
export function rankTrips(trips: WeekendTrip[], out: Map<string, Timed[]>, back: Map<string, Timed[]>): RankedTrip[] {
  const cells = new Map(flexGrid(out, back).map((c) => [`${c.depart}|${c.ret}`, c.price] as const));
  const ranked: RankedTrip[] = [];
  for (const t of trips) {
    const price = cells.get(`${t.departDate}|${t.returnDate}`);
    if (price !== undefined) ranked.push({ ...t, price });
  }
  return ranked.sort((a, b) => a.price - b.price || a.departDate.localeCompare(b.departDate));
}
