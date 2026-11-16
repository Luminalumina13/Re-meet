import { beforeAll, describe, expect, it } from "vitest";
import { fetchRaw } from "@/lib/providers/aggregator";
import { providers as realProviders } from "@/lib/providers/registry";
import type { SearchRequest } from "@/lib/domain/types";

const req: SearchRequest = { origin: "WAW", destination: "BCN", departDate: "2026-12-05", adults: 1, children: 0, infants: 0, cabin: "economy", currency: "EUR" } as SearchRequest;

describe("fetchRaw", () => {
  beforeAll(() => {
    process.env.PROVIDERS = "mock"; // never hit real vendors from tests
  });
  it("shares one upstream fetch between identical concurrent requests", async () => {
    expect(realProviders().length).toBe(1);
    const [a, b] = await Promise.all([fetchRaw(req, { fresh: true }), fetchRaw(req, { fresh: true })]);
    // Same promise result object shape; the second caller did not trigger a second fetch.
    expect(a).toBe(b);
  });
  it("an aborted caller does not cancel the fetch for others", async () => {
    const ctl = new AbortController();
    const r2 = { ...req, departDate: "2026-12-06" };
    const first = fetchRaw(r2, { fresh: true, signal: ctl.signal });
    const second = fetchRaw(r2, { fresh: true });
    ctl.abort();
    const res = await second;
    expect(res.providers.length).toBeGreaterThan(0);
    await first;
  });
});
