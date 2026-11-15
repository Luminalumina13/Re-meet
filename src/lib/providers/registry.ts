import type { FlightProvider } from "./types";
import { MockProvider } from "./mock";
import { KiwiProvider } from "./kiwi";
import { AmadeusProvider } from "./amadeus";
import { DuffelProvider } from "./duffel";
import { RyanairProvider } from "./ryanair";
import { KiwiMcpProvider } from "./kiwiMcp";
import { LastminuteProvider } from "./lastminute";

/**
 * Builds the active provider list from the environment.
 *
 *  Airline connectors (direct, no key):   ryanair        (RYANAIR_ENABLED=0 to turn off)
 *  Multi-airline, no key:                 kiwi           (Kiwi.com public MCP; KIWI_MCP_ENABLED=0 to turn off)
 *                                         lastminute     (lastminute.com public MCP; LASTMINUTE_MCP_ENABLED=0)
 *  Multi-airline, need keys:              duffel, kiwi-tequila, amadeus
 *
 *   PROVIDERS=ryanair,duffel   explicit list (default: every enabled/configured one)
 *   PROVIDERS=mock             demo data only
 *   INCLUDE_DEMO=1             add demo data next to real providers
 * When nothing real is available the demo provider is used so the app always works.
 */
export function buildProviders(env: NodeJS.ProcessEnv = process.env): FlightProvider[] {
  const all: FlightProvider[] = [new KiwiMcpProvider(), new LastminuteProvider(), new RyanairProvider(), new DuffelProvider(), new KiwiProvider(), new AmadeusProvider()];
  const wanted = (env.PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (wanted.length === 1 && wanted[0] === "mock") return [new MockProvider()];

  const selected = wanted.length ? all.filter((p) => wanted.includes(p.id)) : all;
  const configured = selected.filter((p) => p.isConfigured());
  if (!configured.length) return [new MockProvider()];
  if (env.INCLUDE_DEMO === "1" || wanted.includes("mock")) configured.push(new MockProvider());
  return configured;
}

let singleton: FlightProvider[] | null = null;
export function providers(): FlightProvider[] {
  if (!singleton) singleton = buildProviders();
  return singleton;
}

/** For tests. */
export function setProviders(list: FlightProvider[] | null): void {
  singleton = list;
}
