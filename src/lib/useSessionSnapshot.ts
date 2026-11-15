"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a page's form (and results) in sessionStorage so that coming back from an airline's
 * site, a reload or the back button doesn't wipe it. Storage can be unavailable or full, so
 * every access is guarded and the page works without it.
 *
 * `snapshot` must be memoised. `skip` disables restoring (e.g. when the URL carries a search).
 */
export function useSessionSnapshot<T>(key: string, snapshot: T, restore: (saved: Partial<T>) => void, skip = false) {
  const ready = useRef(false);

  // Declared before the restore effect so the first pass cannot overwrite what is stored.
  useEffect(() => {
    if (!ready.current) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      /* private mode or quota: ignore */
    }
  }, [key, snapshot]);

  useEffect(() => {
    if (!skip) {
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) restore(JSON.parse(raw) as Partial<T>);
      } catch {
        /* corrupt or unavailable: start fresh */
      }
    }
    ready.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
