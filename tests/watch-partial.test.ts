import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KiwiMcpProvider, clearKiwiMcpCache, type KiwiMcpResult } from "@/lib/providers/kiwiMcp";
import { fetchRaw } from "@/lib/providers/aggregator";
import { isPartial } from "@/lib/providers/partial";
import { MemoryWatchStore } from "@/lib/watch/store";

const kiwiOw = JSON.parse(readFileSync(join(__dirname, "fixtures", "kiwi-mcp-oneway-waw-bcn.json"), "utf8")) as KiwiMcpResult;
const req = { adults: 1, cabin: "economy" as const, currency: "EUR", origin: "WAW", destination: "BCN", departDate: "2026-11-21" };

beforeEach(() => clearKiwiMcpCache());

describe("partial source results", () => {
  it("flags a Kiwi list when one hour window failed", async () => {
    let n = 0;
    const p = new KiwiMcpProvider({
      call: async () => {
        if (++n === 4) throw new Error("upstream busy");
        return kiwiOw;
      },
    });
    const list = await p.search(req);
    expect(list.length).toBeGreaterThan(0);
    expect(isPartial(list)).toBe(true);
  });

  it("a full answer is not partial", async () => {
    const list = await new KiwiMcpProvider({ call: async () => kiwiOw }).search(req);
    expect(isPartial(list)).toBe(false);
  });

  it("the aggregator reports the source as partial", async () => {
    let n = 0;
    const p = new KiwiMcpProvider({
      call: async () => {
        if (++n === 1) throw new Error("upstream busy");
        return { ...kiwiOw, itineraries: [] };
      },
    });
    vi.spyOn(p, "isConfigured").mockReturnValue(true);
    const res = await fetchRaw({ ...req, departDate: "2026-11-22" }, { fresh: true, providers: [p] });
    expect(res.raw).toEqual([]);
    expect(res.providers[0]).toMatchObject({ status: "ok", partial: true });
  });
});

describe("watch check with an incomplete answer", () => {
  it("does not tell the owner offers are gone", async () => {
    vi.resetModules();
    const responses = [
      { itineraries: [], providers: [{ id: "kiwi", status: "ok", partial: true }] },
    ];
    vi.doMock("@/lib/providers/aggregator", () => ({ search: async () => responses.shift() }));
    const notify = vi.fn();
    vi.doMock("@/lib/watch/notify", () => ({ notify }));
    const { checkWatch } = await import("@/lib/watch/checker");
    const store = new MemoryWatchStore();
    const w = await store.create({
      label: "KIV→VLC",
      params: { kind: "search", request: req },
      currency: "EUR",
      dropThreshold: 0.05,
      notify: {},
    });
    await store.update(w.id, { lastBestPrice: 202, lastCount: 1 });
    const r = await checkWatch(w.id, store);
    expect(r?.alerts).toEqual([]);
    expect(r?.watch.lastCount).toBe(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it("looks once more before reporting that offers vanished", async () => {
    vi.resetModules();
    const it202 = { price: { amount: 202 }, signature: "s202" };
    const responses = [
      { itineraries: [], providers: [{ id: "kiwi", status: "ok" }] },
      { itineraries: [it202], providers: [{ id: "kiwi", status: "ok" }] },
    ];
    vi.doMock("@/lib/providers/aggregator", () => ({ search: async () => responses.shift() }));
    const notify = vi.fn();
    vi.doMock("@/lib/watch/notify", () => ({ notify }));
    const { checkWatch, setRecheckDelay } = await import("@/lib/watch/checker");
    setRecheckDelay(0);
    const store = new MemoryWatchStore();
    const w = await store.create({
      label: "KIV→VLC",
      params: { kind: "search", request: req },
      currency: "EUR",
      dropThreshold: 0.05,
      notify: {},
    });
    await store.update(w.id, { lastBestPrice: 202, lastCount: 1, knownSignatures: ["s202"] });
    const r = await checkWatch(w.id, store);
    expect(r?.alerts).toEqual([]);
    expect(r?.watch.lastCount).toBe(1);
    expect(notify).not.toHaveBeenCalled();
  });
});
