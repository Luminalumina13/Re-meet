import { addDays, diffDays } from "./time";

/**
 * A flexible trip: leave any day in [departDate, departUntil] and come back any day in
 * [returnDate, returnUntil], optionally limited to a number of nights. Without `departUntil`
 * it is an exact trip. Without `returnDate` it is one way.
 */
export interface DateRange {
  departDate: string;
  departUntil?: string;
  returnDate?: string;
  returnUntil?: string;
  minNights?: number;
  maxNights?: number;
}

/** Longest window (days, both ends included) the search page checks day by day. */
export const MAX_RANGE_DAYS = 14;
/** Longest window for the group planner and "anywhere": they search many routes per day. */
export const MAX_GROUP_RANGE_DAYS = 7;
export const MAX_NIGHTS = 30;

/** Every day from `from` to `until` (inclusive); just `from` without `until`. */
export function rangeDays(from: string, until?: string): string[] {
  if (!until || until <= from) return [from];
  const n = diffDays(from, until);
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

export function isRange(r: DateRange): boolean {
  return Boolean((r.departUntil && r.departUntil > r.departDate) || (r.returnUntil && r.returnDate && r.returnUntil > r.returnDate) || r.minNights !== undefined || r.maxNights !== undefined);
}

/** Does this departure/return pair fit the range (dates and nights)? */
export function pairFits(r: DateRange, depart: string, ret: string): boolean {
  if (ret < depart) return false;
  const nights = diffDays(depart, ret);
  if (r.minNights !== undefined && nights < r.minNights) return false;
  if (r.maxNights !== undefined && nights > r.maxNights) return false;
  return true;
}

/** All departure/return pairs of a round-trip range, earliest first. */
export function datePairs(r: DateRange): [string, string][] {
  if (!r.returnDate) return [];
  const out: [string, string][] = [];
  for (const d of rangeDays(r.departDate, r.departUntil))
    for (const ret of rangeDays(r.returnDate, r.returnUntil)) if (pairFits(r, d, ret)) out.push([d, ret]);
  return out;
}

/** The return window that a "N to M nights" choice implies. */
export function nightsWindow(departDate: string, departUntil: string | undefined, minNights: number, maxNights: number): { returnDate: string; returnUntil: string } {
  return { returnDate: addDays(departDate, minNights), returnUntil: addDays(departUntil && departUntil > departDate ? departUntil : departDate, maxNights) };
}

/** What is wrong with a range, if anything; `maxDays` caps each window. */
export function rangeProblem(r: DateRange, maxDays: number): "order" | "tooLong" | "empty" | null {
  if (r.departUntil && r.departUntil < r.departDate) return "order";
  if (r.returnUntil && r.returnDate && r.returnUntil < r.returnDate) return "order";
  if (r.minNights !== undefined && r.maxNights !== undefined && r.maxNights < r.minNights) return "order";
  if (rangeDays(r.departDate, r.departUntil).length > maxDays) return "tooLong";
  if (r.returnDate && rangeDays(r.returnDate, r.returnUntil).length > maxDays + (r.maxNights !== undefined && r.minNights !== undefined ? r.maxNights - r.minNights : 0)) return "tooLong";
  if (r.returnDate && datePairs(r).length === 0) return "empty";
  return null;
}

/**
 * Moves `date` by as many days as the departure moved, so a changed departure keeps the trip
 * length (and the return picker opens on the right month). Never earlier than the new departure.
 */
export function moveWith(date: string, oldDepart: string, newDepart: string): string {
  if (!date || !oldDepart || !newDepart) return date;
  const moved = addDays(date, diffDays(oldDepart, newDepart));
  return moved < newDepart ? newDepart : moved;
}
