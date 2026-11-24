import { addDays } from "@/lib/domain/time";
import { nightsWindow, type DateRange } from "@/lib/domain/dateRange";
import { nextSaturday, todayIso } from "@/lib/domain/dates";

/** What the form holds; `rangeFormToRequest` turns it into the API's date range. */
export interface RangeForm {
  from: string;
  until: string;
  back: "dates" | "nights" | "oneway";
  retFrom: string;
  retUntil: string;
  minNights: number;
  maxNights: number;
}

export function defaultRangeForm(seed: Partial<RangeForm> = {}): RangeForm {
  const from = seed.from && seed.from >= todayIso() ? seed.from : nextSaturday(todayIso());
  const until = seed.until && seed.until >= from ? seed.until : addDays(from, 6);
  return {
    from,
    until,
    back: seed.back ?? "nights",
    retFrom: seed.retFrom && seed.retFrom >= from ? seed.retFrom : addDays(from, 2),
    retUntil: seed.retUntil && seed.retUntil >= (seed.retFrom ?? from) ? seed.retUntil : addDays(until, 4),
    minNights: seed.minNights ?? 2,
    maxNights: seed.maxNights ?? 4,
  };
}

export function rangeFormToRequest(f: RangeForm): DateRange {
  if (f.back === "oneway") return { departDate: f.from, departUntil: f.until };
  if (f.back === "dates") return { departDate: f.from, departUntil: f.until, returnDate: f.retFrom, returnUntil: f.retUntil };
  return { departDate: f.from, departUntil: f.until, ...nightsWindow(f.from, f.until, f.minNights, f.maxNights), minNights: f.minNights, maxNights: f.maxNights };
}

const BACKS = ["dates", "nights", "oneway"] as const;
const isoDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const small = (v: string | null) => (v && /^\d{1,2}$/.test(v) && Number(v) <= 30 ? Number(v) : undefined);

/** Share-link parameters of a range form (the caller marks the mode). */
export function rangeQuery(q: URLSearchParams, f: RangeForm): void {
  q.set("dep", f.from);
  q.set("depTo", f.until);
  q.set("back", f.back);
  if (f.back === "dates") {
    q.set("ret", f.retFrom);
    q.set("retTo", f.retUntil);
  } else if (f.back === "nights") {
    q.set("nMin", String(f.minNights));
    q.set("nMax", String(f.maxNights));
  }
}

/** Reads a range form from a link; undefined unless the link has one. */
export function parseRangeQuery(q: URLSearchParams): Partial<RangeForm> | undefined {
  const until = isoDate(q.get("depTo"));
  if (!until) return undefined;
  const back = BACKS.find((b) => b === q.get("back"));
  return {
    from: isoDate(q.get("dep")),
    until,
    back,
    retFrom: isoDate(q.get("ret")),
    retUntil: isoDate(q.get("retTo")),
    minNights: small(q.get("nMin")),
    maxNights: small(q.get("nMax")),
  };
}
