import { randomUUID } from "node:crypto";
import { search } from "@/lib/providers/aggregator";
import { meetup } from "@/lib/meetup/engine";
import type { Alert, PricePoint, Watch, WatchStore } from "./types";
import { notify } from "./notify";
import { watchStore } from "./store";

export interface Snapshot {
  bestPrice: number | null;
  count: number;
  signatures: string[];
}

/** Re-run the saved query and summarise it. */
export async function snapshot(watch: Watch): Promise<Snapshot> {
  if (watch.params.kind === "search") {
    const res = await search(watch.params.request, { fresh: true });
    const prices = res.itineraries.map((i) => i.price.amount);
    return {
      bestPrice: prices.length ? Math.min(...prices) : null,
      count: res.itineraries.length,
      signatures: res.itineraries.map((i) => i.signature),
    };
  }
  const res = await meetup(watch.params.request, { fresh: true });
  const best = res.frontier.length ? Math.min(...res.frontier.map((f) => f.totalPrice)) : null;
  return {
    bestPrice: best,
    count: res.plans.length,
    signatures: res.plans.map((p) => p.id),
  };
}

/** Pure diff: previous state + new snapshot → alerts. */
export function diffAlerts(watch: Watch, snap: Snapshot, now = new Date().toISOString()): Alert[] {
  const alerts: Alert[] = [];
  const mk = (a: Omit<Alert, "id" | "at">): Alert => ({ id: randomUUID(), at: now, ...a });
  const cur = watch.currency;

  if (snap.bestPrice === null) {
    if (watch.lastBestPrice !== undefined) {
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
        }),
      );
    }
  }
  return alerts;
}

export async function checkWatch(id: string, store: WatchStore = watchStore()): Promise<{ watch: Watch; alerts: Alert[] } | null> {
  const watch = await store.get(id);
  if (!watch) return null;
  const snap = await snapshot(watch);
  const now = new Date().toISOString();
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
    }
  }
  return { checked, alerts: alertCount };
}
