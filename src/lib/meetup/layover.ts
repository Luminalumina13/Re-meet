import type { Itinerary, Leg } from "@/lib/domain/types";
import type { FriendPlan, LayoverMeet, SharedFlight } from "./types";

/** Shortest overlap worth calling a meeting: enough for a coffee. */
export const MIN_LAYOVER_MEET_MIN = 45;

interface Stop {
  airport: string;
  from: number;
  to: number;
}

function stopsOf(leg: Leg): Stop[] {
  const out: Stop[] = [];
  for (let i = 0; i + 1 < leg.segments.length; i++) {
    const a = leg.segments[i];
    const b = leg.segments[i + 1];
    out.push({ airport: a.to, from: Date.parse(a.arriveUtc), to: Date.parse(b.departUtc) });
  }
  return out;
}

/** Connections two friends of a plan share: the same airport, overlapping waits. Needs no extra searches. */
export function findLayoverMeets(friends: FriendPlan[]): LayoverMeet[] {
  const res: LayoverMeet[] = [];
  for (const direction of ["outbound", "inbound"] as const) {
    const withStops = friends
      .map((f) => ({ id: f.friend.id, it: f[direction] as Itinerary | null }))
      .filter((x): x is { id: string; it: Itinerary } => x.it !== null)
      .map((x) => ({ id: x.id, stops: stopsOf(x.it.legs[0]) }));
    for (let i = 0; i < withStops.length; i++) {
      for (let j = i + 1; j < withStops.length; j++) {
        for (const a of withStops[i].stops) {
          for (const b of withStops[j].stops) {
            if (a.airport !== b.airport) continue;
            const start = Math.max(a.from, b.from);
            const end = Math.min(a.to, b.to);
            const minutes = Math.round((end - start) / 60000);
            if (minutes >= MIN_LAYOVER_MEET_MIN) res.push({ airport: a.airport, minutes, startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString(), friendIds: [withStops[i].id, withStops[j].id], direction });
          }
        }
      }
    }
  }
  return res.sort((x, y) => y.minutes - x.minutes);
}

/** Flights two friends both take (same carrier, number and departure): they join up and travel on together. */
export function findSharedFlights(friends: FriendPlan[]): SharedFlight[] {
  const res: SharedFlight[] = [];
  for (const direction of ["outbound", "inbound"] as const) {
    const people = friends
      .map((f) => ({ id: f.friend.id, it: f[direction] as Itinerary | null }))
      .filter((x): x is { id: string; it: Itinerary } => x.it !== null);
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const theirs = new Set(people[j].it.legs[0].segments.map((s) => `${s.carrier}${s.flightNumber}|${s.departUtc}`));
        for (const s of people[i].it.legs[0].segments) {
          if (theirs.has(`${s.carrier}${s.flightNumber}|${s.departUtc}`)) res.push({ flight: `${s.carrier}${s.flightNumber}`, from: s.from, to: s.to, friendIds: [people[i].id, people[j].id], direction });
        }
      }
    }
  }
  return res;
}
