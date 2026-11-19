import type { Itinerary, Leg, SearchRequest, Segment } from "@/lib/domain/types";
import { AIRPORTS, distanceKm, getAirport, isMajor } from "@/lib/data/airports";
import type { ExploreRequest } from "@/lib/explore/types";
import type { Airport } from "@/lib/domain/types";
import { localToUtc, utcToLocal, minutesToHhmm, weekday } from "@/lib/domain/time";
import type { FlightProvider } from "./types";
import { finalize, legFromSegments } from "./util";

/**
 * Deterministic synthetic flight data so the product works end-to-end without API keys.
 * Schedules are a pure function of (origin, destination, date); prices additionally drift
 * with `volatilitySeed` (defaults to the current hour) so price tracking has something to track.
 */

interface Carrier {
  code: string;
  name: string;
  factor: number; // price multiplier
}

const LCC: Carrier[] = [
  { code: "FR", name: "Ryanair", factor: 0.65 },
  { code: "W6", name: "Wizz Air", factor: 0.7 },
  { code: "U2", name: "easyJet", factor: 0.78 },
  { code: "VY", name: "Vueling", factor: 0.8 },
];
const LEGACY: Carrier[] = [
  { code: "LH", name: "Lufthansa", factor: 1.35 },
  { code: "KL", name: "KLM", factor: 1.3 },
  { code: "AF", name: "Air France", factor: 1.3 },
  { code: "LO", name: "LOT Polish Airlines", factor: 1.1 },
  { code: "OS", name: "Austrian", factor: 1.25 },
  { code: "TK", name: "Turkish Airlines", factor: 1.05 },
  { code: "A3", name: "Aegean", factor: 1.0 },
  { code: "IB", name: "Iberia", factor: 1.15 },
];
const HUBS = ["FRA", "AMS", "CDG", "WAW", "VIE", "MUC", "IST", "ZRH"];
const HUB_CARRIER: Record<string, Carrier> = {
  FRA: LEGACY[0],
  MUC: LEGACY[0],
  AMS: LEGACY[1],
  CDG: LEGACY[2],
  WAW: LEGACY[3],
  VIE: LEGACY[4],
  IST: LEGACY[5],
  ZRH: { code: "LX", name: "SWISS", factor: 1.4 },
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function flightMinutes(km: number, r: () => number): number {
  return Math.round(35 + (km / 780) * 60 + (r() - 0.5) * 20);
}

function timeOfDayFactor(depMin: number): number {
  if (depMin < 7 * 60) return 0.8; // red-eye
  if (depMin < 10 * 60) return 1.15; // prime morning
  if (depMin < 16 * 60) return 1.0;
  if (depMin < 20 * 60) return 1.1;
  return 0.85;
}

interface Params {
  volatilitySeed?: number;
  /** Multiplier of generated flight count, for tests */
  density?: number;
}

export class MockProvider implements FlightProvider {
  readonly id = "mock";
  readonly name = "Demo data";
  readonly kind = "demo" as const;
  readonly demo = true;
  private readonly volatility: number;
  private readonly density: number;

  constructor(params: Params = {}) {
    this.volatility = params.volatilitySeed ?? Math.floor(Date.now() / 3_600_000);
    this.density = params.density ?? 1;
  }

  isConfigured(): boolean {
    return true;
  }

  async search(req: SearchRequest): Promise<Itinerary[]> {
    const from = getAirport(req.origin);
    const to = getAirport(req.destination);
    if (!from || !to || from.iata === to.iata) return [];
    const out = this.legsForDay(from, to, req.departDate);
    if (!req.returnDate) {
      return out.map((leg, i) => this.toItinerary(req, [leg], i));
    }
    const back = this.legsForDay(to, from, req.returnDate);
    const r = rng(hash(`${from.iata}${to.iata}${req.departDate}${req.returnDate}combo`));
    const combos: Itinerary[] = [];
    for (const o of out) {
      for (const b of back) {
        // Not every pairing is sold as a package; keep a realistic ~75 % subset.
        if (r() < 0.25) continue;
        combos.push(this.toItinerary(req, [o, b], combos.length));
      }
    }
    return combos;
  }

  /** Demo "anywhere": round trips to the nearest airports a direct flight reaches within the limit. */
  async explore(req: ExploreRequest): Promise<Itinerary[]> {
    const from = getAirport(req.origin);
    if (!from) return [];
    const reach = req.maxFlightHours * 60;
    const targets = AIRPORTS.filter((a) => isMajor(a) && a.city !== from.city)
      .map((a) => ({ a, km: distanceKm(from, a) }))
      .filter((x) => 35 + (x.km / 780) * 60 <= reach + 15)
      .sort((x, y) => x.km - y.km)
      .slice(0, 30);
    const lists = await Promise.all(
      targets.map(({ a }) =>
        this.search({
          origin: from.iata,
          destination: a.iata,
          departDate: req.departDate,
          returnDate: req.returnDate,
          adults: req.adults,
          children: req.children,
          infants: req.infants,
          cabin: req.cabin,
          currency: req.currency,
        }),
      ),
    );
    return lists.flat();
  }

  private toItinerary(req: SearchRequest, legs: Leg[], idx: number): Itinerary {
    const price = this.priceFor(legs, req);
    const q = `Flights from ${req.origin} to ${req.destination} on ${req.departDate}${
      req.returnDate ? ` returning ${req.returnDate}` : ""
    }`;
    return finalize({
      id: `mock-${hash(legs.map((l) => l.segments.map((s) => s.flightNumber + s.departUtc).join()).join("|"))}-${idx}`,
      provider: this.id,
      providerName: this.name,
      legs,
      price: { amount: price, currency: req.currency },
      deepLink: `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`,
      seatsLeft: 1 + (hash(legs[0].departUtc + idx) % 9),
    });
  }

  private priceFor(legs: Leg[], req: SearchRequest): number {
    let total = 0;
    for (const leg of legs) {
      const a = getAirport(leg.from)!;
      const b = getAirport(leg.to)!;
      const km = distanceKm(a, b);
      const r = rng(hash(`${leg.segments[0].flightNumber}${leg.departUtc}${this.volatility}`));
      const carrierFactor = leg.segments.reduce((f, s) => f * (carrierByCode(s.carrier)?.factor ?? 1), 1) ** (1 / leg.segments.length);
      const dow = weekday(leg.departLocal.slice(0, 10));
      const dowFactor = dow === 5 || dow === 0 ? 1.15 : dow === 6 ? 1.05 : 1;
      const depMin = +leg.departLocal.slice(11, 13) * 60 + +leg.departLocal.slice(14, 16);
      const base = 22 + km * 0.048;
      const stopsFactor = leg.stops ? 0.82 : 1;
      const noise = 0.8 + r() * 0.4;
      total += base * carrierFactor * timeOfDayFactor(depMin) * dowFactor * stopsFactor * noise;
    }
    if (legs.length === 2) total *= 0.93;
    // Child fare ≈ 75 % of adult, infant on a lap ≈ 10 %.
    total *= req.adults + 0.75 * (req.children ?? 0) + 0.1 * (req.infants ?? 0);
    if (req.cabin === "business") total *= 3.2;
    else if (req.cabin === "premium_economy") total *= 1.8;
    else if (req.cabin === "first") total *= 5;
    return Math.round(total);
  }

  /** All one-way options between two airports on a given local date. */
  legsForDay(from: Airport, to: Airport, date: string): Leg[] {
    const km = distanceKm(from, to);
    const r = rng(hash(`${from.iata}>${to.iata}@${date}`));
    const legs: Leg[] = [];
    const directs = Math.round((km < 1200 ? 6 + r() * 6 : km < 3000 ? 4 + r() * 4 : 2 + r() * 2) * this.density);
    const pool = [...LCC, ...LEGACY];
    for (let i = 0; i < directs; i++) {
      const carrier = pool[Math.floor(r() * pool.length)];
      const depMin = 330 + Math.floor(r() * 1000); // 05:30 .. 22:10
      const dur = flightMinutes(km, r);
      legs.push(legFromSegments([this.segment(from, to, date, depMin, dur, carrier, r)]));
    }
    const oneStops = Math.round((km > 600 ? 3 + r() * 5 : 1 + r() * 2) * this.density);
    for (let i = 0; i < oneStops; i++) {
      const hubCode = HUBS[Math.floor(r() * HUBS.length)];
      const hub = getAirport(hubCode);
      if (!hub || hub.iata === from.iata || hub.iata === to.iata) continue;
      const carrier = HUB_CARRIER[hubCode] ?? LEGACY[0];
      const depMin = 330 + Math.floor(r() * 900);
      const d1 = flightMinutes(distanceKm(from, hub), r);
      const layover = 55 + Math.floor(r() * 150);
      const d2 = flightMinutes(distanceKm(hub, to), r);
      const s1 = this.segment(from, hub, date, depMin, d1, carrier, r);
      const s2Dep = new Date(Date.parse(s1.arriveUtc) + layover * 60000);
      const s2 = this.segmentFromUtc(hub, to, s2Dep, d2, carrier, r);
      legs.push(legFromSegments([s1, s2]));
    }
    legs.sort((a, b) => a.departUtc.localeCompare(b.departUtc));
    return legs;
  }

  private segment(from: Airport, to: Airport, date: string, depMin: number, dur: number, c: Carrier, r: () => number): Segment {
    const departLocal = `${date}T${minutesToHhmm(depMin)}`;
    const departUtc = localToUtc(departLocal, from.tz);
    const arriveUtc = new Date(Date.parse(departUtc) + dur * 60000).toISOString();
    return {
      from: from.iata,
      to: to.iata,
      departLocal,
      arriveLocal: utcToLocal(arriveUtc, to.tz),
      departUtc,
      arriveUtc,
      carrier: c.code,
      carrierName: c.name,
      flightNumber: String(100 + Math.floor(r() * 8900)),
      durationMin: dur,
    };
  }

  private segmentFromUtc(from: Airport, to: Airport, dep: Date, dur: number, c: Carrier, r: () => number): Segment {
    const departUtc = dep.toISOString();
    const arriveUtc = new Date(dep.getTime() + dur * 60000).toISOString();
    return {
      from: from.iata,
      to: to.iata,
      departLocal: utcToLocal(departUtc, from.tz),
      arriveLocal: utcToLocal(arriveUtc, to.tz),
      departUtc,
      arriveUtc,
      carrier: c.code,
      carrierName: c.name,
      flightNumber: String(100 + Math.floor(r() * 8900)),
      durationMin: dur,
    };
  }
}

function carrierByCode(code: string): Carrier | undefined {
  return [...LCC, ...LEGACY, ...Object.values(HUB_CARRIER)].find((c) => c.code === code);
}
