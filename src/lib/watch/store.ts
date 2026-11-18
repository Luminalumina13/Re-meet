import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { NewWatch, Watch, WatchStore } from "./types";

const HISTORY_CAP = 300;
const ALERT_CAP = 60;

function fresh(w: NewWatch): Watch {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    label: w.label,
    params: w.params,
    currency: w.currency,
    targetPrice: w.targetPrice,
    dropThreshold: w.dropThreshold ?? 0.05,
    notify: w.notify ?? {},
    ownerHash: w.ownerHash,
    active: true,
    createdAt: now,
    updatedAt: now,
    knownSignatures: [],
    history: [],
    alerts: [],
  };
}

export function trimWatch(w: Watch): Watch {
  if (w.history.length > HISTORY_CAP) w.history = w.history.slice(-HISTORY_CAP);
  if (w.alerts.length > ALERT_CAP) w.alerts = w.alerts.slice(-ALERT_CAP);
  return w;
}

export class MemoryWatchStore implements WatchStore {
  protected items = new Map<string, Watch>();

  async list(): Promise<Watch[]> {
    return [...this.items.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async get(id: string): Promise<Watch | undefined> {
    return this.items.get(id);
  }
  async create(w: NewWatch): Promise<Watch> {
    const item = fresh(w);
    this.items.set(item.id, item);
    await this.persist();
    return item;
  }
  async update(id: string, patch: Partial<Watch>): Promise<Watch | undefined> {
    const cur = this.items.get(id);
    if (!cur) return undefined;
    const next = trimWatch({ ...cur, ...patch, id, updatedAt: new Date().toISOString() });
    this.items.set(id, next);
    await this.persist();
    return next;
  }
  async delete(id: string): Promise<boolean> {
    const ok = this.items.delete(id);
    if (ok) await this.persist();
    return ok;
  }
  protected async persist(): Promise<void> {}
}

/**
 * JSON-file store: zero-dependency persistence that survives restarts on a single node.
 * Writes are atomic (temp file + rename). Replace with a DB-backed store for multi-instance setups.
 */
export class FileWatchStore extends MemoryWatchStore {
  private loaded = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {
    super();
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await readFile(this.file, "utf8");
      const arr = JSON.parse(raw) as Watch[];
      for (const w of arr) this.items.set(w.id, w);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }

  override async list() {
    await this.load();
    return super.list();
  }
  override async get(id: string) {
    await this.load();
    return super.get(id);
  }
  override async create(w: NewWatch) {
    await this.load();
    return super.create(w);
  }
  override async update(id: string, patch: Partial<Watch>) {
    await this.load();
    return super.update(id, patch);
  }
  override async delete(id: string) {
    await this.load();
    return super.delete(id);
  }

  protected override persist(): Promise<void> {
    const snapshot = JSON.stringify([...this.items.values()], null, 2);
    this.queue = this.queue.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, snapshot, "utf8");
      await rename(tmp, this.file);
    });
    return this.queue;
  }
}

// Next.js bundles instrumentation.ts (scheduler, Telegram polling) separately from API routes, so a
// module-level variable would give each its own copy that overwrites the other's writes. Share via globalThis.
const g = globalThis as { __watchStore?: WatchStore | null };
export function watchStore(): WatchStore {
  if (!g.__watchStore) {
    const dir = process.env.DATA_DIR ?? join(process.cwd(), "data");
    g.__watchStore = new FileWatchStore(join(dir, "watches.json"));
  }
  return g.__watchStore;
}
export function setWatchStore(s: WatchStore | null): void {
  g.__watchStore = s;
}
