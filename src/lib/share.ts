import type { WeekendShape } from "@/lib/domain/dates";

/**
 * Shareable links: every form state that defines a search lives in the URL, so opening the link
 * shows the same form and runs the same search. Parsing is strict and never throws: anything
 * unrecognised is simply ignored, because links come from outside.
 */

const SHAPES: WeekendShape[] = ["sat-sun", "fri-sun", "sat-mon", "fri-mon", "thu-sun"];
const CABINS = ["economy", "premium_economy", "business", "first"] as const;
export type SharedCabin = (typeof CABINS)[number];

const iata = (v: string | null | undefined) => (v && /^[A-Za-z]{3}$/.test(v) ? v.toUpperCase() : undefined);
const date = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const int = (v: string | null | undefined, min: number, max: number) => {
  if (v == null || !/^\d{1,3}$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
};

interface Party {
  adults?: number;
  children?: number;
  infants?: number;
}
function partyParams(q: URLSearchParams, p: Party) {
  if (p.adults && p.adults !== 1) q.set("a", String(p.adults));
  if (p.children) q.set("c", String(p.children));
  if (p.infants) q.set("i", String(p.infants));
}
function parseParty(q: URLSearchParams): Party {
  const adults = int(q.get("a"), 1, 9);
  const children = int(q.get("c"), 0, 8);
  const infants = int(q.get("i"), 0, 4);
  // Same rules as the API: an adult per infant, nine seats at most.
  const a = adults ?? 1;
  const c = children ?? 0;
  const i = Math.min(infants ?? 0, a);
  if (a + c + i > 9) return { adults: a };
  return { adults: adults, children, infants: infants === undefined ? undefined : i };
}

export interface SharedSearch extends Party {
  origin?: string;
  destination?: string;
  /** Weekend mode: the Saturday and the shape. Custom mode: exact dates (no return = one way). */
  saturday?: string;
  shape?: WeekendShape;
  departDate?: string;
  returnDate?: string;
  cabin?: SharedCabin;
  /** Complex route: the legs after the first (the first is origin, destination and departDate). */
  legs?: SharedLeg[];
  /** Also search nearby airports: radius in km or "country". */
  oSpread?: SharedSpread;
  dSpread?: SharedSpread;
}

export interface SharedLeg {
  from: string;
  to: string;
  date: string;
}
export type SharedSpread = 100 | 200 | 300 | "country";
const SPREADS: SharedSpread[] = [100, 200, 300, "country"];
const spread = (v: string | null): SharedSpread | undefined => SPREADS.find((s) => String(s) === v);
const MAX_LEGS = 4;

export interface SearchShareState extends SharedSearch {
  mode: "weekend" | "custom" | "multi";
}

export function buildSearchQuery(s: SearchShareState): string {
  const q = new URLSearchParams();
  if (s.origin) q.set("from", s.origin);
  if (s.destination) q.set("to", s.destination);
  if (s.mode === "weekend") {
    if (s.saturday) q.set("sat", s.saturday);
    if (s.shape && s.shape !== "sat-sun") q.set("shape", s.shape);
  } else if (s.mode === "multi") {
    if (s.departDate) q.set("dep", s.departDate);
    for (const l of (s.legs ?? []).slice(0, MAX_LEGS)) q.append("leg", `${l.from}.${l.to}.${l.date}`);
  } else {
    if (s.departDate) q.set("dep", s.departDate);
    if (s.returnDate) q.set("ret", s.returnDate);
  }
  if (s.mode !== "multi") {
    if (s.oSpread) q.set("os", String(s.oSpread));
    if (s.dSpread) q.set("ds", String(s.dSpread));
  }
  partyParams(q, s);
  if (s.cabin && s.cabin !== "economy") q.set("cabin", s.cabin);
  return q.toString();
}

export function parseSearchQuery(q: URLSearchParams): SharedSearch & { mode?: "weekend" | "custom" | "multi" } {
  const shape = q.get("shape") as WeekendShape | null;
  const cabin = q.get("cabin") as SharedCabin | null;
  const dep = date(q.get("dep"));
  const legs = q
    .getAll("leg")
    .slice(0, MAX_LEGS)
    .map((v): SharedLeg | null => {
      const [from, to, d] = v.split(".");
      const f = iata(from);
      const t = iata(to);
      const dt = date(d);
      return f && t && dt && f !== t ? { from: f, to: t, date: dt } : null;
    });
  const validLegs = legs.length > 0 && dep && legs.every((l): l is SharedLeg => l !== null) ? (legs as SharedLeg[]) : undefined;
  return {
    origin: iata(q.get("from")),
    destination: iata(q.get("to")),
    mode: validLegs ? "multi" : dep ? "custom" : q.get("sat") ? "weekend" : undefined,
    legs: validLegs,
    oSpread: spread(q.get("os")),
    dSpread: spread(q.get("ds")),
    saturday: date(q.get("sat")),
    shape: shape && SHAPES.includes(shape) ? shape : undefined,
    departDate: dep,
    returnDate: date(q.get("ret")),
    cabin: cabin && CABINS.includes(cabin) ? cabin : undefined,
    ...parseParty(q),
  };
}

export interface ExploreShareState extends Party {
  origin?: string;
  /** Weekend mode (default): the Saturday and the shape. Custom mode: exact dates, both required. */
  mode?: "weekend" | "custom";
  saturday?: string;
  shape?: WeekendShape;
  departDate?: string;
  returnDate?: string;
  maxHours?: number;
  directOnly?: boolean;
  budget?: string;
}

export function buildExploreQuery(s: ExploreShareState): string {
  const q = new URLSearchParams();
  if (s.origin) q.set("from", s.origin);
  if (s.mode === "custom") {
    if (s.departDate) q.set("dep", s.departDate);
    if (s.returnDate) q.set("ret", s.returnDate);
  } else {
    if (s.saturday) q.set("sat", s.saturday);
    if (s.shape && s.shape !== "sat-sun") q.set("shape", s.shape);
  }
  if (s.maxHours && s.maxHours !== 4) q.set("h", String(s.maxHours));
  if (s.directOnly) q.set("direct", "1");
  if (s.budget && /^\d+$/.test(s.budget)) q.set("budget", s.budget);
  partyParams(q, s);
  return q.toString();
}

export function parseExploreQuery(q: URLSearchParams): ExploreShareState {
  const shape = q.get("shape") as WeekendShape | null;
  const budget = q.get("budget");
  const dep = date(q.get("dep"));
  const ret = date(q.get("ret"));
  // "Anywhere" needs a return date; a link with only a departure falls back to the weekend form.
  const custom = Boolean(dep && ret && ret >= dep);
  return {
    origin: iata(q.get("from")),
    mode: custom ? "custom" : undefined,
    departDate: custom ? dep : undefined,
    returnDate: custom ? ret : undefined,
    saturday: date(q.get("sat")),
    shape: shape && SHAPES.includes(shape) ? shape : undefined,
    maxHours: int(q.get("h"), 1, 12),
    directOnly: q.get("direct") === "1" ? true : undefined,
    budget: budget && /^\d{1,5}$/.test(budget) ? budget : undefined,
    ...parseParty(q),
  };
}

export interface MeetupShareState {
  friends: { name: string; origins: string[] }[];
  destinations: string[];
  mode: "weekend" | "custom";
  saturday?: string;
  shape?: WeekendShape;
  departDate?: string;
  returnDate?: string;
  valuePerHour?: number;
  budget?: string;
  includeOrigins?: boolean;
}

/** Friends travel as `Name~WAW.KRK` (airports joined by dots), comma separated and URL-encoded. */
export function buildMeetupQuery(s: MeetupShareState): string {
  const q = new URLSearchParams();
  const friends = s.friends.filter((f) => f.name.trim() && f.origins.some(Boolean));
  if (friends.length) q.set("f", friends.map((f) => `${f.name.trim().replace(/[~,]/g, " ")}~${f.origins.filter(Boolean).join(".")}`).join(","));
  const dest = s.destinations.filter(Boolean);
  if (dest.length) q.set("to", dest.join(","));
  if (s.includeOrigins) q.set("own", "1");
  if (s.mode === "weekend") {
    if (s.saturday) q.set("sat", s.saturday);
    if (s.shape && s.shape !== "sat-sun") q.set("shape", s.shape);
  } else {
    if (s.departDate) q.set("dep", s.departDate);
    if (s.returnDate) q.set("ret", s.returnDate);
  }
  if (s.valuePerHour && s.valuePerHour !== 15) q.set("vph", String(s.valuePerHour));
  if (s.budget && /^\d+$/.test(s.budget)) q.set("budget", s.budget);
  return q.toString();
}

export function parseMeetupQuery(q: URLSearchParams): Partial<MeetupShareState> {
  const friends: MeetupShareState["friends"] = [];
  for (const part of (q.get("f") ?? "").split(",").slice(0, 6)) {
    const [name, airports] = part.split("~");
    const origins = (airports ?? "").split(".").map(iata).filter((x): x is string => Boolean(x)).slice(0, 4);
    if (name?.trim() && origins.length) friends.push({ name: name.trim().slice(0, 40), origins });
  }
  const destinations = (q.get("to") ?? "").split(",").map(iata).filter((x): x is string => Boolean(x)).slice(0, 4);
  const dep = date(q.get("dep"));
  const shape = q.get("shape") as WeekendShape | null;
  const budget = q.get("budget");
  return {
    friends: friends.length >= 2 ? friends : undefined,
    destinations: destinations.length ? destinations : undefined,
    includeOrigins: q.get("own") === "1" ? true : undefined,
    mode: dep ? "custom" : q.get("sat") ? "weekend" : undefined,
    saturday: date(q.get("sat")),
    shape: shape && SHAPES.includes(shape) ? shape : undefined,
    departDate: dep,
    returnDate: date(q.get("ret")),
    valuePerHour: int(q.get("vph"), 1, 60),
    budget: budget && /^\d{1,5}$/.test(budget) ? budget : undefined,
  };
}
