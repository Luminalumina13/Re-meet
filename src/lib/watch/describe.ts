import { getAirport } from "@/lib/data/airports";
import type { Watch } from "./types";

/** One-line summary of what a watch tracks ("Warsaw → Barcelona · 2026-11-28 – 2026-11-29"). */
export function describeWatch(w: Watch, hoursUnit = "h"): string {
  const city = (code: string) => getAirport(code)?.city ?? code;
  if (w.params.kind === "search") {
    const r = w.params.request;
    return `${city(r.origin)} → ${city(r.destination)} · ${r.departDate}${r.returnDate ? ` – ${r.returnDate}` : ""}`;
  }
  if (w.params.kind === "explore") {
    const r = w.params.request;
    return `${city(r.origin)} → ✈ ≤ ${r.maxFlightHours} ${hoursUnit} · ${r.departDate} – ${r.returnDate}`;
  }
  const r = w.params.request;
  return `${r.friends.map((f) => f.name).join(", ")} → ${r.destinations.map(city).join("/")} · ${r.departDate} – ${r.returnDate}`;
}
