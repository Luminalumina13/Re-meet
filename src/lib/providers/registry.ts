import type { FlightProvider } from "./types";
import { MockProvider } from "./mock";
import { KiwiProvider } from "./kiwi";
import { AmadeusProvider } from "./amadeus";
import { DuffelProvider } from "./duffel";

/**
 * Builds the active provider list from the environment.
 *   PROVIDERS=kiwi,amadeus,duffel   explicit list (default: all configured real ones)
 *   PROVIDERS=mock                  force demo data
 * When no real provider is configured the demo provider is used so the app always works.
 */
export function buildProviders(env: NodeJS.ProcessEnv = process.env): FlightProvider[] {
  const all: FlightProvider[] = [new KiwiProvider(), new AmadeusProvider(), new DuffelProvider()];
  const wanted = (env.PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (wanted.includes("mock")) return [new MockProvider()];

  const selected = wanted.length ? all.filter((p) => wanted.includes(p.id)) : all;
  const configured = selected.filter((p) => p.isConfigured());
  if (!configured.length) return [new MockProvider()];
  if (env.INCLUDE_DEMO === "1") configured.push(new MockProvider());
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
