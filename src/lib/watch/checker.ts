import { randomUUID } from "node:crypto";
import { search } from "@/lib/providers/aggregator";
import { meetup } from "@/lib/meetup/engine";
import { explore } from "@/lib/explore/engine";
import type { Alert, PricePoint, Watch, WatchStore } from "./types";
import { notify } from "./notify";
import { reportError } from "@/lib/errorReport";
import { watchStore } from "./store";

export interface Snapshot {
  bestPrice: number | null;
  count: number;
  signatures: string[];
  /** False when a data source failed: the numbers are then not comparable with earlier checks. */
  complete?: boolean;
}

const allOk = (providers: { status: string }[]) => providers.every((p) => p.status !== "error");

/** Re-run the saved query and summarise it. */
export async function snapshot(watch: Watch): Promise<Snapshot> {
  if (watch.params.kind === "search") {
    const res = await search(watch.params.request, { fresh: true });
    const prices = res.itineraries.map((i) => i.price.amount);
    return {
      bestPrice: prices.length ? Math.min(...prices) : null,
      count: res.itineraries.length,
      signatures: res.itineraries.map((i) => i.signature),
      complete: allOk(res.providers),
    };
  }
  if (watch.params.kind === "explore") {
    const res = await explore(watch.params.request, { fresh: true });
    const prices = res.destinations.map((d) => d.cheapest.price.amount);
    return {
      bestPrice: prices.length ? Math.min(...prices) : null,
      count: res.destinations.length,
      // A new destination or a new best flight to a known one counts as a new offer.
      signatures: res.destinations.map((d) => `${d.key}|${d.cheapest.signature}`),
      complete: allOk(res.providers),
    };
  }
  const res = await meetup(watch.params.request, { fresh: true });
  const best = res.frontier.length ? Math.min(...res.frontier.map((f) => f.totalPrice)) : null;
  return {
    bestPrice: best,
    count: res.plans.length,
    signatures: res.plans.map((p) => p.id),
    complete: allOk(res.providers),
  };
}

/** Pure diff: previous state + new snapshot → alerts. */
export function diffAlerts(watch: Watch, snap: Snapshot, now = new Date().toISOString()): Alert[] {
  const alerts: Alert[] = [];
  if (snap.complete === false) return alerts;
  const mk = (a: Omit<Alert, "id" | "at">): Alert => ({ id: randomUUID(), at: now, ...a });
  const cur = watch.currency;

  if (snap.bestPrice === null) {
    // Once per outage: lastCount drops to 0 after the first report.
    if ((watch.lastCount ?? 0) > 0) {
      alerts.push(mk({ type: "no_results", message: `No offers match “${watch.label}” any more.` }));
    }
    return alerts;
  }
  const prev = watch.lastBestPrice;
  if (prev !== undefined && prev > 0) {
    const rel = (snap.bestPrice - prev) / prev;
    if (rel <= -watch.dropThreshold) {
      alerts.push(
        mk({
          type: "price_drop",
          message: `Price dropped ${Math.round(-rel * 100)} %: ${prev} → ${snap.bestPrice} ${cur}`,
          price: snap.bestPrice,
          previousPrice: prev,
        }),
      );
    } else if (rel >= Math.max(0.15, watch.dropThreshold * 2)) {
      alerts.push(
        mk({
          type: "price_rise",
          message: `Price rose ${Math.round(rel * 100)} %: ${prev} → ${snap.bestPrice} ${cur}`,
          price: snap.bestPrice,
          previousPrice: prev,
        }),
      );
    }
  }
  if (watch.targetPrice !== undefined && snap.bestPrice <= watch.targetPrice && (prev === undefined || prev > watch.targetPrice)) {
    alerts.push(
      mk({
        type: "target_reached",
        message: `Target price reached: ${snap.bestPrice} ${cur} (target ${watch.targetPrice} ${cur})`,
        price: snap.bestPrice,
      }),
    );
  }
  if (watch.knownSignatures.length) {
    const known = new Set(watch.knownSignatures);
    const fresh = snap.signatures.filter((s) => !known.has(s));
    if (fresh.length) {
      alerts.push(
        mk({
          type: "new_offer",
          message: `${fresh.length} new offer${fresh.length > 1 ? "s" : ""} appeared (${snap.count} total)`,
          signatures: fresh.slice(0, 20),
          count: fresh.length,
          total: snap.count,
        }),
      );
    }
  }
  return alerts;
}

// One check per watch at a time: a manual check and the scheduler would otherwise both read the same
// old state and overwrite each other's history and alerts.
const gl = globalThis as { __watchLocks?: Map<string, Promise<unknown>> };
const locks = (gl.__watchLocks ??= new Map());

export function checkWatch(id: string, store: WatchStore = watchStore()): Promise<{ watch: Watch; alerts: Alert[] } | null> {
  const prev = locks.get(id) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => checkWatchNow(id, store));
  locks.set(id, run);
  const cleanup = () => {
    if (locks.get(id) === run) locks.delete(id);
  };
  run.then(cleanup, cleanup);
  return run;
}

async function checkWatchNow(id: string, store: WatchStore): Promise<{ watch: Watch; alerts: Alert[] } | null> {
  const watch = await store.get(id);
  if (!watch) return null;
  const snap = await snapshot(watch);
  const now = new Date().toISOString();
  if (snap.complete === false) {
    // A source failed: record that we looked, but keep the baseline and raise nothing.
    const updated = await store.update(id, { lastCheckedAt: now });
    return { watch: updated ?? watch, alerts: [] };
  }
  const alerts = diffAlerts(watch, snap, now);
  const point: PricePoint | null = snap.bestPrice === null ? null : { at: now, bestPrice: snap.bestPrice, count: snap.count };
  const updated = await store.update(id, {
    lastCheckedAt: now,
    lastBestPrice: snap.bestPrice ?? watch.lastBestPrice,
    lastCount: snap.count,
    knownSignatures: [...new Set([...watch.knownSignatures, ...snap.signatures])].slice(-2000),
    history: point ? [...watch.history, point] : watch.history,
    alerts: [...watch.alerts, ...alerts],
  });
  if (updated && alerts.length) await notify(updated, alerts);
  return { watch: updated ?? watch, alerts };
}

/** Check every active watch whose last check is older than `minIntervalMin`. */
export async function checkDue(minIntervalMin: number, store: WatchStore = watchStore()): Promise<{ checked: number; alerts: number }> {
  const all = await store.list();
  const cutoff = Date.now() - minIntervalMin * 60_000;
  let checked = 0;
  let alertCount = 0;
  for (const w of all) {
    if (!w.active) continue;
    if (w.lastCheckedAt && Date.parse(w.lastCheckedAt) > cutoff) continue;
    try {
      const r = await checkWatch(w.id, store);
      checked++;
      alertCount += r?.alerts.length ?? 0;
    } catch (e) {
      console.warn(`[watch:${w.id}] check failed`, e);
      void reportError("watch check", e);
    }
  }
  return { checked, alerts: alertCount };
}
