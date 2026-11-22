import type { SearchResponse } from "@/lib/domain/types";
import type { SearchRequestInput } from "@/lib/api/schemas";
import { postJson } from "@/lib/client";
import type { IATA } from "@/lib/domain/types";

const CONCURRENCY = 4;

/** One /api/search per airport pair, a few at a time, merged into a single response. Fails only when every pair fails. */
export async function searchPairs(pairs: [IATA, IATA][], base: SearchRequestInput): Promise<SearchResponse> {
  if (pairs.length === 1) return postJson<SearchResponse>("/api/search", { ...base, origin: pairs[0][0], destination: pairs[0][1] });
  const results: (SearchResponse | null)[] = new Array(pairs.length).fill(null);
  let firstError: unknown;
  let next = 0;
  async function worker() {
    while (next < pairs.length) {
      const i = next++;
      try {
        results[i] = await postJson<SearchResponse>("/api/search", { ...base, origin: pairs[i][0], destination: pairs[i][1] });
      } catch (e) {
        firstError ??= e;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pairs.length) }, worker));
  const ok = results.filter((r): r is SearchResponse => r !== null);
  if (ok.length === 0) throw firstError;
  const seen = new Set<string>();
  const itineraries = ok.flatMap((r) => r.itineraries).filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
  const providers = new Map<string, SearchResponse["providers"][number]>();
  for (const r of ok) for (const p of r.providers) providers.set(p.id, providers.get(p.id)?.status === "ok" ? providers.get(p.id)! : p);
  return { ...ok[0], itineraries, providers: [...providers.values()], cached: ok.every((r) => r.cached) };
}
