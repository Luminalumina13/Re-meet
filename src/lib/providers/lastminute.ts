import { markPartial } from "./partial";
import type { Itinerary, Leg, SearchRequest } from "@/lib/domain/types";
import { getAirport } from "@/lib/data/airports";
import { addDays, localToUtc, utcToLocal } from "@/lib/domain/time";
import type { FlightProvider } from "./types";
import { ProviderError } from "./types";
import { TtlCache } from "./cache";
import { gateFor } from "./gate";
import { finalize, httpJson } from "./util";
import { parseRpc } from "./kiwiMcp";

/**
 * lastminute.com connector over its official public MCP server (https://mcp.lastminute.com/mcp),
 * no API key needed. Results carry airline, times, duration and stop count, but no flight numbers
 * or connection airports, so legs are modelled as a single block segment and de-duplicated
 * against richer sources by route + times.
 *
 * Env: LASTMINUTE_MCP_ENABLED=0 disables it. LASTMINUTE_MCP_URL overrides the endpoint.
 */

export interface LmFlight {
  airline: string;
  carrier_id?: string;
  departure?: string | null; // "WAW 15:05"
  arrival?: string | null; // "BCN 10:30+1"
  duration?: string | null; // "3 hours and 10 min"
  outbound?: string | null; // "WAW 15:05 → BCN 18:15"
  return?: string | null;
  duration_out?: string | null;
  duration_ret?: string | null;
  stops: string; // "Direct" | "1 stop" | "Both Direct" | "Out: 1 | Ret: 0"
  price_amount: number; // cents
  deeplink?: string;
}

export interface LmResult {
  success: boolean;
  flights: LmFlight[];
  currency: string;
  is_roundtrip: boolean;
  error?: string;
}

export type LmCaller = (args: Record<string, unknown>, signal?: AbortSignal) => Promise<LmResult>;

const WINDOWS: [string, string][] = [
  ["00:00", "09:59"],
  ["10:00", "13:59"],
  ["14:00", "17:59"],
  ["18:00", "23:59"],
];

/** Airline display names → IATA codes, for the return leg (the API gives a code for the outbound only). */
const AIRLINE_CODES: Record<string, string> = {
  ryanair: "FR",
  wizzair: "W6",
  "wizz air": "W6",
  easyjet: "U2",
  vueling: "VY",
  lufthansa: "LH",
  klm: "KL",
  "air france": "AF",
  "tap-portugal": "TP",
  "tap portugal": "TP",
  swiss: "LX",
  "sas scandinavian airlines": "SK",
  sas: "SK",
  "lot - polish airlines": "LO",
  lot: "LO",
  "austrian airlines": "OS",
  austrian: "OS",
  "brussels airlines": "SN",
  iberia: "IB",
  "turkish airlines": "TK",
  "ita airways": "AZ",
  "british airways": "BA",
  "aegean airlines": "A3",
  eurowings: "EW",
  transavia: "HV",
  norwegian: "DY",
  airbaltic: "BT",
  volotea: "V7",
  "pegasus airlines": "PC",
  finnair: "AY",
};

export function airlineCode(name: string): string {
  const key = name.split("+")[0].trim().toLowerCase();
  return AIRLINE_CODES[key] ?? "";
}

const gate = gateFor("lastminute", { concurrency: Number(process.env.LASTMINUTE_MCP_CONCURRENCY ?? 6), perMinute: 90 });
const cache = new TtlCache<LmResult>(10 * 60_000, 2000);
let rpcId = 0;

export function httpLmCaller(url: string): LmCaller {
  return async (args, signal) => {
    const { status, body } = await gate.run(() =>
      httpJson<string>(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-06-18",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name: "search_flights", arguments: args } }),
        signal,
        timeoutMs: 40000,
      }),
    );
    if (status !== 200) throw new ProviderError("lastminute", `MCP HTTP ${status}`, status);
    const msg = parseRpc(typeof body === "string" ? body : JSON.stringify(body));
    if (msg.error) throw new ProviderError("lastminute", msg.error.message);
    const text = msg.result?.content?.[0]?.text;
    if (!text) throw new ProviderError("lastminute", "MCP response without content");
    let res: LmResult;
    try {
      res = JSON.parse(text) as LmResult;
    } catch {
      throw new ProviderError("lastminute", text.slice(0, 200));
    }
    if (msg.result?.isError || res.success === false) throw new ProviderError("lastminute", res.error ?? text.slice(0, 200));
    return res;
  };
}

/** "3 hours and 10 min" | "10 hours" | "45 min" | "1 hour" → minutes */
export function parseDuration(s: string | null | undefined): number {
  if (!s) return 0;
  const h = /(\d+)\s*hour/.exec(s);
  const m = /(\d+)\s*min/.exec(s);
  return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
}

/** "WAW 15:05" or "BCN 10:30+1" → { iata, time, plusDays } */
export function parsePoint(s: string): { iata: string; time: string; plusDays: number } {
  const m = /^([A-Z]{3})\s+(\d{2}:\d{2})(?:\s*\+(\d+))?/.exec(s.trim());
  if (!m) throw new Error(`Bad point: ${s}`);
  return { iata: m[1], time: m[2], plusDays: m[3] ? +m[3] : 0 };
}

/** "Direct" → [0]; "1 stop" → [1]; "Both Direct" → [0,0]; "Out: 1 | Ret: 0" → [1,0] */
export function parseStops(s: string): number[] {
  const t = s.trim().toLowerCase();
  if (t === "both direct") return [0, 0];
  const rt = /out:\s*(\d+).*ret:\s*(\d+)/.exec(t);
  if (rt) return [+rt[1], +rt[2]];
  if (t.startsWith("direct")) return [0];
  const n = /(\d+)/.exec(t);
  return [n ? +n[1] : 0];
}

function buildLeg(dep: string, arr: string, date: string, durationMin: number, stops: number, airline: string, code: string): Leg {
  const a = parsePoint(dep);
  const b = parsePoint(arr);
  const departLocal = `${date}T${a.time}`;
  const fromTz = getAirport(a.iata)?.tz;
  const toTz = getAirport(b.iata)?.tz;
  const arriveLocal = `${addDays(date, b.plusDays)}T${b.time}`;
  let departUtc: string;
  if (fromTz) departUtc = localToUtc(departLocal, fromTz);
  else if (toTz) departUtc = new Date(Date.parse(localToUtc(arriveLocal, toTz)) - durationMin * 60000).toISOString();
  else departUtc = new Date(`${departLocal}:00Z`).toISOString();
  const dur = durationMin || (toTz ? Math.round((Date.parse(localToUtc(arriveLocal, toTz)) - Date.parse(departUtc)) / 60000) : 0);
  const arriveUtc = new Date(Date.parse(departUtc) + dur * 60000).toISOString();
  return {
    from: a.iata,
    to: b.iata,
    departLocal,
    arriveLocal: toTz ? utcToLocal(arriveUtc, toTz) : arriveLocal,
    departUtc,
    arriveUtc,
    durationMin: dur,
    stops,
    segments: [
      {
        from: a.iata,
        to: b.iata,
        departLocal,
        arriveLocal: toTz ? utcToLocal(arriveUtc, toTz) : arriveLocal,
        departUtc,
        arriveUtc,
        carrier: code,
        carrierName: airline.trim(),
        flightNumber: "",
        durationMin: dur,
      },
    ],
  };
}

export class LastminuteProvider implements FlightProvider {
  readonly id = "lastminute";
  readonly name = "lastminute.com";
  readonly kind = "aggregator" as const;
  private readonly call: LmCaller;
  private readonly enabled: boolean;

  constructor(opts: { call?: LmCaller; enabled?: boolean } = {}) {
    this.call = opts.call ?? httpLmCaller(process.env.LASTMINUTE_MCP_URL ?? "https://mcp.lastminute.com/mcp");
    this.enabled = opts.enabled ?? process.env.LASTMINUTE_MCP_ENABLED !== "0";
  }

  isConfigured(): boolean {
    return this.enabled;
  }

  plan(req: SearchRequest): Record<string, unknown>[] {
    const f = req.filters ?? {};
    const lo = f.outbound?.departAfter ?? "00:00";
    const hi = f.outbound?.departBefore ?? "23:59";
    const base: Record<string, unknown> = {
      departure: req.origin,
      arrival: req.destination,
      start_date: req.departDate,
      adults: req.adults,
      // The tool wants ages; the UI only knows the bracket, so use a typical age inside it.
      ...(req.children ? { children_ages: Array(req.children).fill(8).join(",") } : {}),
      ...(req.infants ? { infants_ages: Array(req.infants).fill(1).join(",") } : {}),
      max_results: 20,
      language: "en",
    };
    if (req.returnDate) base.end_date = req.returnDate;
    if (req.cabin !== "economy") base.flight_class = { premium_economy: "PREMIUM_ECONOMY", business: "BUSINESS", first: "FIRST_CLASS" }[req.cabin];
    if (f.maxStops !== undefined) base.max_stops = String(f.maxStops);
    if (f.maxPrice !== undefined) base.max_price_cents = String(Math.round(f.maxPrice * 100));
    if (f.carriers?.length) base.airlines_include = f.carriers.join(",");
    if (req.quick) return [{ ...base, departure_time_start: lo, departure_time_end: hi }];
    return WINDOWS.filter(([a, b]) => b >= lo && a <= hi).map(([a, b]) => ({
      ...base,
      departure_time_start: a > lo ? a : lo,
      departure_time_end: b < hi ? b : hi,
    }));
  }

  async search(req: SearchRequest, signal?: AbortSignal): Promise<Itinerary[]> {
    const results = await Promise.allSettled(
      this.plan(req).map(async (args) => {
        const key = JSON.stringify(args);
        const hit = cache.get(key);
        if (hit) return hit;
        const res = await this.call(args, signal);
        cache.set(key, res);
        return res;
      }),
    );
    const ok = results.filter((r): r is PromiseFulfilledResult<LmResult> => r.status === "fulfilled");
    if (!ok.length && results.length) throw (results[0] as PromiseRejectedResult).reason;
    const out = new Map<string, Itinerary>();
    for (const r of ok) {
      // The service prices in its own market currency; never mix currencies in one ranking.
      if (r.value.currency && r.value.currency.toUpperCase() !== req.currency.toUpperCase()) continue;
      for (const f of r.value.flights ?? []) {
        const it = this.map(f, req, r.value.currency || req.currency);
        if (it && !out.has(it.signature)) out.set(it.signature, it);
      }
    }
    return markPartial([...out.values()], ok.length < results.length);
  }

  map(f: LmFlight, req: SearchRequest, currency: string): Itinerary | null {
    try {
      const stops = parseStops(f.stops);
      const names = f.airline.split(" / ");
      const outCode = f.carrier_id ?? airlineCode(names[0]);
      const legs: Leg[] = [];
      if (f.outbound && f.return && req.returnDate) {
        const [od, oa] = f.outbound.split("→").map((s) => s.trim());
        const [rd, ra] = f.return.split("→").map((s) => s.trim());
        legs.push(buildLeg(od, oa, req.departDate, parseDuration(f.duration_out), stops[0] ?? 0, names[0], outCode));
        const retName = names[1] ?? names[0];
        legs.push(buildLeg(rd, ra, req.returnDate, parseDuration(f.duration_ret), stops[1] ?? stops[0] ?? 0, retName, names[1] ? airlineCode(retName) : outCode));
      } else if (f.departure && f.arrival) {
        legs.push(buildLeg(f.departure, f.arrival, req.departDate, parseDuration(f.duration), stops[0] ?? 0, names[0], outCode));
      } else return null;
      return finalize({
        id: `lastminute-${legs.map((l) => `${l.from}${l.to}${l.departUtc}>${l.arriveUtc}`).join("|")}-${f.price_amount}`,
        provider: this.id,
        providerName: this.name,
        legs,
        price: { amount: Math.round(f.price_amount) / 100, currency },
        deepLink: f.deeplink,
      });
    } catch {
      return null;
    }
  }
}

export function clearLastminuteCache(): void {
  cache.clear();
}
