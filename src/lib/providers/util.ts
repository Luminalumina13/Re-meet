import type { Itinerary, Leg, Segment } from "@/lib/domain/types";
import { minutesBetween } from "@/lib/domain/time";

/** Build a Leg from its segments, deriving totals. */
export function legFromSegments(segments: Segment[]): Leg {
  if (!segments.length) throw new Error("Leg needs at least one segment");
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    from: first.from,
    to: last.to,
    departLocal: first.departLocal,
    arriveLocal: last.arriveLocal,
    departUtc: first.departUtc,
    arriveUtc: last.arriveUtc,
    durationMin: minutesBetween(first.departUtc, last.arriveUtc),
    stops: segments.length - 1,
    segments,
  };
}

/** Flight fingerprint independent of provider — used for de-duplication and "new offer" detection. */
export function signatureOf(legs: Leg[]): string {
  return legs
    .map((l) =>
      l.segments.every((s) => s.flightNumber)
        ? l.segments.map((s) => `${s.carrier}${s.flightNumber}@${s.departUtc.slice(0, 16)}`).join(">")
        : `${l.segments[0]?.carrier ?? ""}:${l.from}${l.to}@${l.departUtc.slice(0, 16)}>${l.arriveUtc.slice(0, 16)}/${l.stops}`,
    )
    .join("|");
}

/**
 * Provider-independent identity of a trip: same route and same departure/arrival instants.
 * Two different airlines with identical times on one route are practically non-existent,
 * so this matches one source's "W6 WAW 15:05→BCN 18:15" with another's "W6 1477".
 */
export function tripKey(legs: Leg[]): string {
  return legs.map((l) => `${l.from}${l.to}@${l.departUtc.slice(0, 16)}>${l.arriveUtc.slice(0, 16)}`).join("|");
}

/** How much detail a source gave about the legs (flight numbers and connection airports). */
export function detailScore(it: Itinerary): number {
  return it.legs.reduce((s, l) => s + l.segments.filter((g) => g.flightNumber).length + (l.segments.length === l.stops + 1 ? 1 : 0), 0);
}

export function finalize(partial: Omit<Itinerary, "signature">): Itinerary {
  return { ...partial, signature: signatureOf(partial.legs) };
}

/** Parse ISO-8601 durations like "PT2H35M" into minutes. */
export function isoDurationToMinutes(d: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(d);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 1440 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
}

/** Small typed fetch wrapper with timeout, used by all HTTP connectors. */
export async function httpJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; body: T }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20000);
  const outer = init.signal;
  const onAbort = () => ctrl.abort();
  outer?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: T;
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = text as unknown as T;
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onAbort);
  }
}
