"use client";

import { useCallback, useMemo, useState } from "react";
import type { SearchFilters } from "@/lib/domain/types";
import { idealFiltersFor } from "@/lib/domain/filters";

type Times = Pick<SearchFilters, "outbound" | "inbound">;
type Rest = Omit<SearchFilters, "outbound" | "inbound">;

export interface FilterState {
  times: Times | null;
  rest: Rest;
}

/**
 * Search filters whose time windows follow the trip's departure day until the user edits them
 * (afternoon departure on Fridays, otherwise after breakfast). Picking the default values
 * again hands control back to the date.
 */
export function useSearchFilters(departDate: string) {
  const [times, setTimes] = useState<Times | null>(null);
  const [rest, setRest] = useState<Rest>({});

  const filters = useMemo<SearchFilters>(() => {
    const { outbound, inbound } = times ?? idealFiltersFor(departDate);
    return { ...rest, outbound, inbound };
  }, [times, rest, departDate]);

  const setFilters = useCallback(
    (f: SearchFilters) => {
      const { outbound, inbound, ...others } = f;
      const ideal = idealFiltersFor(departDate);
      setRest(others);
      setTimes(JSON.stringify({ outbound, inbound }) === JSON.stringify({ outbound: ideal.outbound, inbound: ideal.inbound }) ? null : { outbound, inbound });
    },
    [departDate],
  );

  const state = useMemo<FilterState>(() => ({ times, rest }), [times, rest]);
  const restore = useCallback((s?: Partial<FilterState>) => {
    if (!s) return;
    setTimes(s.times ?? null);
    setRest(s.rest ?? {});
  }, []);

  return { filters, setFilters, state, restore };
}
