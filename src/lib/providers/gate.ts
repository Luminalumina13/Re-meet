import { ProviderError } from "./types";

/**
 * One gate per upstream service, shared by every visitor of the site:
 * - at most `concurrency` requests at once and `perMinute` per rolling minute (a token bucket);
 *   a request waits for a slot up to `maxWaitMs`, then fails instead of piling up;
 * - after a 429 or a run of failures the service gets a pause (30 s, doubling up to 5 min) during
 *   which requests fail at once without reaching it;
 * - counters per service, logged once a minute while there is traffic (`[upstream] …`).
 */
export interface GateOptions {
  concurrency: number;
  perMinute: number;
  maxWaitMs?: number;
  /** Failures in a row (5xx, timeouts) that trigger a pause. */
  failuresToPause?: number;
  now?: () => number;
}

export interface GateStats {
  calls: number;
  errors: number;
  throttled: number;
  paused: number;
  waitedMs: number;
}

const BASE_PAUSE_MS = 30_000;
const MAX_PAUSE_MS = 5 * 60_000;

export class Gate {
  private active = 0;
  private tokens: number;
  private refilledAt: number;
  private readonly queue: { start: () => void; deadline: number; fail: (e: Error) => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pausedUntil = 0;
  private pauses = 0;
  private failuresInRow = 0;
  readonly minute: GateStats = emptyStats();
  readonly day: GateStats = emptyStats();
  private readonly now: () => number;

  constructor(
    readonly id: string,
    private readonly opts: GateOptions,
  ) {
    this.now = opts.now ?? Date.now;
    this.tokens = opts.perMinute;
    this.refilledAt = this.now();
    gates.set(id, this);
  }

  /** Runs `task` when a slot is free. A result with an HTTP `status` is checked for 429 / 5xx. */
  run<T>(task: () => Promise<T>): Promise<T> {
    const t = this.now();
    if (t < this.pausedUntil) {
      this.count("paused");
      return Promise.reject(new ProviderError(this.id, `paused after upstream errors for ${Math.ceil((this.pausedUntil - t) / 1000)} s`, 503));
    }
    const queuedAt = t;
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active++;
        this.tokens--;
        this.count("calls");
        this.add("waitedMs", this.now() - queuedAt);
        task()
          .then((res) => {
            this.observe(statusOf(res));
            resolve(res);
          })
          .catch((e: unknown) => {
            if (!isAbort(e)) this.observe(e instanceof ProviderError && e.status ? e.status : 0);
            reject(e);
          })
          .finally(() => {
            this.active--;
            this.pump();
          });
      };
      this.queue.push({ start, deadline: queuedAt + (this.opts.maxWaitMs ?? 20_000), fail: reject });
      this.pump();
    });
  }

  private refill() {
    const t = this.now();
    const add = ((t - this.refilledAt) / 60_000) * this.opts.perMinute;
    if (add > 0) {
      this.tokens = Math.min(this.opts.perMinute, this.tokens + add);
      this.refilledAt = t;
    }
  }

  private pump() {
    this.refill();
    const t = this.now();
    while (this.queue.length) {
      const head = this.queue[0];
      if (t > head.deadline || t < this.pausedUntil) {
        this.queue.shift();
        this.count("throttled");
        head.fail(new ProviderError(this.id, t < this.pausedUntil ? "paused after upstream errors" : "too many requests to this source right now", 503));
        continue;
      }
      if (this.active >= this.opts.concurrency || this.tokens < 1) break;
      this.queue.shift();
      head.start();
    }
    if (this.queue.length && this.tokens < 1 && !this.timer) {
      // Wake up when the next token is due.
      const wait = Math.ceil(((1 - this.tokens) / this.opts.perMinute) * 60_000);
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pump();
      }, Math.max(10, wait));
      (this.timer as { unref?: () => void }).unref?.();
    }
  }

  /** 429 pauses at once; 5xx, timeouts and network errors pause after a few in a row. */
  private observe(status: number | undefined) {
    if (status === undefined || (status >= 200 && status < 500 && status !== 429)) {
      this.failuresInRow = 0;
      this.pauses = 0;
      return;
    }
    this.count("errors");
    this.failuresInRow++;
    if (status === 429 || this.failuresInRow >= (this.opts.failuresToPause ?? 5)) {
      const ms = Math.min(MAX_PAUSE_MS, BASE_PAUSE_MS * 2 ** this.pauses);
      this.pauses++;
      this.failuresInRow = 0;
      this.pausedUntil = this.now() + ms;
      console.warn(`[upstream] ${this.id} paused for ${ms / 1000} s after ${status === 429 ? "429" : "repeated errors"}`);
    }
  }

  isPaused(): boolean {
    return this.now() < this.pausedUntil;
  }

  private count(k: Exclude<keyof GateStats, "waitedMs">) {
    this.minute[k]++;
    this.day[k]++;
  }
  private add(k: keyof GateStats, n: number) {
    this.minute[k] += n;
    this.day[k] += n;
  }
}

function emptyStats(): GateStats {
  return { calls: 0, errors: 0, throttled: 0, paused: 0, waitedMs: 0 };
}

function statusOf(res: unknown): number | undefined {
  return res && typeof res === "object" && "status" in res && typeof (res as { status: unknown }).status === "number" ? (res as { status: number }).status : undefined;
}

function isAbort(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

const gates = new Map<string, Gate>();
const envInt = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/** The shared gate of a service; limits can be tuned with `<ID>_CONCURRENCY` / `<ID>_PER_MINUTE`. */
export function gateFor(id: string, defaults: { concurrency: number; perMinute: number }): Gate {
  const key = id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return gates.get(id) ?? new Gate(id, { concurrency: envInt(`${key}_CONCURRENCY`, defaults.concurrency), perMinute: envInt(`${key}_PER_MINUTE`, defaults.perMinute) });
}

/** Snapshot of the counters, for logs and tests. */
export function upstreamStats(): Record<string, { minute: GateStats; day: GateStats; paused: boolean }> {
  return Object.fromEntries([...gates].map(([id, g]) => [id, { minute: { ...g.minute }, day: { ...g.day }, paused: g.isPaused() }]));
}

/** One log line a minute with each service's traffic, and a daily total at midnight UTC. */
function startLogging() {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;
  let day = new Date().toISOString().slice(0, 10);
  const t = setInterval(() => {
    const busy = [...gates.values()].filter((g) => g.minute.calls || g.minute.throttled || g.minute.paused);
    if (busy.length) {
      console.log(`[upstream] minute ${JSON.stringify(Object.fromEntries(busy.map((g) => [g.id, { ...g.minute, waitedMs: Math.round(g.minute.waitedMs / Math.max(1, g.minute.calls)) }])))}`);
      for (const g of busy) Object.assign(g.minute, emptyStats());
    }
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      console.log(`[upstream] day ${day} ${JSON.stringify(Object.fromEntries([...gates].map(([id, g]) => [id, g.day])))}`);
      for (const g of gates.values()) Object.assign(g.day, emptyStats());
      day = today;
    }
  }, 60_000);
  (t as { unref?: () => void }).unref?.();
}
startLogging();
