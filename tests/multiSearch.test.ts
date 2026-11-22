import { afterEach, describe, expect, it, vi } from "vitest";
import { searchPairs } from "@/lib/multiSearch";
import type { SearchRequestInput } from "@/lib/api/schemas";

const base = { departDate: "2026-12-05", adults: 1, children: 0, infants: 0, cabin: "economy", currency: "EUR" } as unknown as SearchRequestInput;
const resp = (ids: string[], provider = "mock") => ({ request: {}, itineraries: ids.map((id) => ({ id })), providers: [{ id: provider, name: provider, kind: "mock", status: "ok", count: ids.length, ms: 1 }], cached: false, generatedAt: "x" });

afterEach(() => vi.unstubAllGlobals());

describe("searchPairs", () => {
  it("merges and dedupes results of several airport pairs", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string);
      seen.push(`${b.origin}-${b.destination}`);
      return new Response(JSON.stringify(b.origin === "WAW" ? resp(["a", "b"]) : resp(["b", "c"])));
    }));
    const r = await searchPairs([["WAW", "BCN"], ["WMI", "BCN"]], base);
    expect(seen.sort()).toEqual(["WAW-BCN", "WMI-BCN"]);
    expect(r.itineraries.map((i) => i.id).sort()).toEqual(["a", "b", "c"]);
    expect(r.providers).toHaveLength(1);
  });
  it("survives one failing pair but fails when all fail", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string);
      return b.origin === "WMI" ? new Response("{}", { status: 500 }) : new Response(JSON.stringify(resp(["a"])));
    }));
    expect((await searchPairs([["WAW", "BCN"], ["WMI", "BCN"]], base)).itineraries).toHaveLength(1);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    await expect(searchPairs([["WAW", "BCN"], ["WMI", "BCN"]], base)).rejects.toBeTruthy();
  });
});
