"use client";

import { useEffect } from "react";
import { loadExtraAirports } from "@/lib/data/airports";

/** Fetches the full airport list in the background once the page is idle, so names and time zones of any airport are known. */
export function ExtraAirports() {
  useEffect(() => {
    const run = () => void loadExtraAirports();
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 1500);
    return () => clearTimeout(id);
  }, []);
  return null;
}
