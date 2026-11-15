/**
 * Time-zone utilities built only on Intl (no dependencies).
 * Local times are "YYYY-MM-DDTHH:MM" strings without offset, always paired with an IANA zone.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dtf(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    dtf(tz);
    return true;
  } catch {
    return false;
  }
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInZone(utcMs: number, tz: string): Parts {
  const parts = dtf(tz).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of `tz` from UTC in minutes at the given UTC instant (positive east of Greenwich). */
export function tzOffsetMinutes(utcMs: number, tz: string): number {
  const p = partsInZone(utcMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/** Convert a UTC instant to a local ISO string "YYYY-MM-DDTHH:MM" in `tz`. */
export function utcToLocal(utcIso: string | number | Date, tz: string): string {
  const ms = typeof utcIso === "number" ? utcIso : new Date(utcIso).getTime();
  const p = partsInZone(ms, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Convert a local wall-clock ISO string ("YYYY-MM-DDTHH:MM[:SS]") in `tz` to a UTC ISO string. */
export function localToUtc(localIso: string, tz: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(localIso);
  if (!m) throw new Error(`Bad local ISO: ${localIso}`);
  const [, y, mo, d, h, mi, s] = m;
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  // Two-pass fix-point: guess offset at naive instant, then re-evaluate at the corrected instant.
  let guess = naive - tzOffsetMinutes(naive, tz) * 60000;
  guess = naive - tzOffsetMinutes(guess, tz) * 60000;
  return new Date(guess).toISOString();
}

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "HH:MM" -> minutes since midnight */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** minutes since midnight -> "HH:MM" */
export function minutesToHhmm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Minutes since local midnight of a local ISO string. */
export function localMinutes(localIso: string): number {
  return hhmmToMinutes(localIso.slice(11, 16));
}

export function localDate(localIso: string): string {
  return localIso.slice(0, 10);
}

export function localTime(localIso: string): string {
  return localIso.slice(11, 16);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + days);
  return new Date(t).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/** 0 = Sunday ... 6 = Saturday, for a YYYY-MM-DD date. */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function minutesBetween(aUtcIso: string, bUtcIso: string): number {
  return Math.round((Date.parse(bUtcIso) - Date.parse(aUtcIso)) / 60000);
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
